import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPublicClient, http } from "viem";
import type { AbiEvent } from "viem";
import {
  IndexedEventRecord,
  IndexerMetrics,
  IndexerSourceConfig,
  IndexerSourceState,
} from "./indexer.types";
import {
  INDEXER_PERSISTENCE,
  IndexerPersistence,
} from "./persistence/indexer-persistence.interface";

const DEFAULT_POLL_MS = 12_000;
const DEFAULT_LOOKBACK_BLOCKS = 12;
const MAX_QUERY_LIMIT = 200;

/** Recursively convert bigint values to strings so records are JSON-safe. */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return value;
}

/**
 * Generic on-chain event indexer (shared infrastructure).
 *
 * Semantics ported from MyShop worker/src/apiServer.js:
 * - Poll-driven (viem getLogs), interval INDEXER_POLL_MS (default 12s).
 * - Replay lookback: every round rescans from `lastProcessedBlock - LOOKBACK`
 *   (INDEXER_LOOKBACK_BLOCKS, default 12) so briefly-missed logs are recovered.
 * - Dedup: `txHash:logIndex` unique key; rescanned hits are skipped.
 * - Reorg rollback: block hashes of observed blocks (log blocks + poll tips)
 *   are recorded per source; a hash change at a recorded height deletes all
 *   events at/after that height and rewinds the cursor to rescan.
 *
 * Ships with ZERO registered sources — consumers (MyShop purchases, MyTask
 * tasks, ...) call registerSource(). With no sources the poll loop idles
 * without touching the RPC.
 */
@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);

  private publicClient: any;
  private readonly sources = new Map<string, IndexerSourceConfig>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private needsReconnect = false;

  private pollIntervalMs = DEFAULT_POLL_MS;
  private lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS;

  // ── metrics state ─────────────────────────────────────────────────────────
  private latestBlock: number | null = null;
  private lastError: string | null = null;
  private lastErrorAt: string | null = null;
  private reconnectCount = 0;
  private totalPolls = 0;
  private reorgCount = 0;
  private readonly eventsIndexed = new Map<string, number>();
  private readonly lastProcessed = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(INDEXER_PERSISTENCE) private readonly persistence: IndexerPersistence
  ) {}

  onModuleInit() {
    this.pollIntervalMs = Number(this.configService.get("INDEXER_POLL_MS") ?? DEFAULT_POLL_MS);
    this.lookbackBlocks = Number(
      this.configService.get("INDEXER_LOOKBACK_BLOCKS") ?? DEFAULT_LOOKBACK_BLOCKS
    );
    this.createClient();
    this.timer = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
    // Do not keep the process alive just for the indexer.
    if (typeof this.timer.unref === "function") this.timer.unref();
    this.logger.log(
      `Indexer started (pollIntervalMs=${this.pollIntervalMs}, lookbackBlocks=${this.lookbackBlocks}, sources=0)`
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private createClient() {
    // Same RPC source as ethereum/registry services: env-driven ETH_RPC_URL.
    const rpcUrl = this.configService.get<string>("ethRpcUrl");
    this.publicClient = createPublicClient({ transport: http(rpcUrl) });
  }

  // ── registration ──────────────────────────────────────────────────────────

  /**
   * Register an event source. Idempotency is the caller's concern: a duplicate
   * key throws so two modules cannot silently fight over one cursor.
   */
  registerSource(config: IndexerSourceConfig): void {
    if (!config?.key) throw new Error("Indexer source requires a non-empty key");
    if (this.sources.has(config.key)) {
      throw new Error(`Indexer source already registered: ${config.key}`);
    }
    if (!config.address) throw new Error(`Indexer source ${config.key} requires an address`);
    if (!Array.isArray(config.abi) || config.abi.length === 0) {
      throw new Error(`Indexer source ${config.key} requires a non-empty ABI`);
    }
    if (!Array.isArray(config.events) || config.events.length === 0) {
      throw new Error(`Indexer source ${config.key} requires at least one event name`);
    }
    const known = new Set(
      config.abi.filter(item => item.type === "event").map(item => (item as AbiEvent).name)
    );
    const missing = config.events.filter(name => !known.has(name));
    if (missing.length > 0) {
      throw new Error(`Indexer source ${config.key}: events not in ABI: ${missing.join(", ")}`);
    }
    this.sources.set(config.key, { ...config, fromBlock: Math.max(0, config.fromBlock) });
    this.eventsIndexed.set(config.key, this.eventsIndexed.get(config.key) ?? 0);
    this.logger.log(
      `Registered indexer source "${config.key}" (${config.address}, events=[${config.events.join(", ")}], fromBlock=${config.fromBlock})`
    );
  }

  // ── poll loop ─────────────────────────────────────────────────────────────

  /** One poll round. Public so consumers/tests can force a tick. */
  async pollOnce(): Promise<void> {
    if (this.polling) return; // previous round still running — skip overlap
    if (this.sources.size === 0) return; // pure idle: no sources, no RPC
    this.polling = true;
    this.totalPolls += 1;
    try {
      if (this.needsReconnect) {
        this.createClient();
        this.reconnectCount += 1;
        this.needsReconnect = false;
        this.logger.warn(
          `Recreated RPC client after error (reconnectCount=${this.reconnectCount})`
        );
      }
      const latest = Number(await this.publicClient.getBlockNumber());
      this.latestBlock = latest;
      // Fetch the tip hash once per round; recorded per source for reorg checks.
      const tipBlock = await this.publicClient.getBlock({ blockNumber: BigInt(latest) });
      for (const source of this.sources.values()) {
        await this.pollSource(source, latest, tipBlock?.hash ?? null);
      }
    } catch (error) {
      this.recordError(error);
      this.needsReconnect = true;
    } finally {
      this.polling = false;
    }
  }

  private async pollSource(
    source: IndexerSourceConfig,
    latest: number,
    tipHash: string | null
  ): Promise<void> {
    try {
      let state = await this.persistence.getState(source.key);
      if (!state) {
        state = {
          source: source.key,
          lastProcessedBlock: source.fromBlock - 1,
          blockHashes: {},
          updatedAt: new Date().toISOString(),
        };
      }

      // Reorg check: a recorded height whose canonical hash changed means we
      // indexed a dropped fork — delete from that height and rescan.
      const reorgHeight = await this.detectReorg(state, latest);
      if (reorgHeight !== null) {
        const dropped = await this.persistence.deleteEventsFromBlock(source.key, reorgHeight);
        for (const heightKey of Object.keys(state.blockHashes)) {
          if (Number(heightKey) >= reorgHeight) delete state.blockHashes[heightKey];
        }
        state.lastProcessedBlock = Math.max(source.fromBlock - 1, reorgHeight - 1);
        this.reorgCount += 1;
        this.logger.warn(
          `[${source.key}] reorg detected at block ${reorgHeight}: dropped ${dropped} event(s), rescanning`
        );
      }

      // Replay lookback: rescan the tail window every round.
      const scanFrom = Math.max(source.fromBlock, state.lastProcessedBlock - this.lookbackBlocks);
      if (scanFrom > latest) return; // chain has not reached fromBlock yet

      const eventAbis = source.abi.filter(
        item => item.type === "event" && source.events.includes((item as AbiEvent).name)
      ) as AbiEvent[];

      const logs: any[] = await this.publicClient.getLogs({
        address: source.address,
        events: eventAbis,
        fromBlock: BigInt(scanFrom),
        toBlock: BigInt(latest),
      });

      let newCount = 0;
      for (const log of logs) {
        const blockNumber = Number(log.blockNumber);
        if (log.blockHash) state.blockHashes[String(blockNumber)] = log.blockHash;

        const id = `${log.transactionHash}:${Number(log.logIndex)}`;
        if (await this.persistence.hasEvent(id)) continue; // dedup: rescan hit

        const record: IndexedEventRecord = {
          id,
          source: source.key,
          eventName: log.eventName ?? "unknown",
          contractAddress: source.address,
          blockNumber,
          blockHash: log.blockHash ?? "",
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          args: (toJsonSafe(log.args ?? {}) as Record<string, unknown>) ?? {},
          createdAt: new Date().toISOString(),
        };
        await this.persistence.saveEvent(record);
        newCount += 1;
      }

      if (tipHash) state.blockHashes[String(latest)] = tipHash;
      state.lastProcessedBlock = latest;
      this.pruneBlockHashes(state);
      state.updatedAt = new Date().toISOString();
      await this.persistence.saveState(state);

      this.lastProcessed.set(source.key, latest);
      if (newCount > 0) {
        this.eventsIndexed.set(source.key, (this.eventsIndexed.get(source.key) ?? 0) + newCount);
        this.logger.log(`[${source.key}] indexed ${newCount} new event(s) up to block ${latest}`);
      }
    } catch (error) {
      this.recordError(error, source.key);
      this.needsReconnect = true;
    }
  }

  /**
   * Walk recorded block hashes from highest to lowest; the first height that
   * still matches the canonical chain proves everything below it (common-case
   * cost: one getBlock). Returns the lowest mismatched height, or null.
   */
  private async detectReorg(state: IndexerSourceState, latest: number): Promise<number | null> {
    const heights = Object.keys(state.blockHashes)
      .map(Number)
      .filter(h => h <= latest && h <= state.lastProcessedBlock)
      .sort((a, b) => b - a);
    let lowestMismatch: number | null = null;
    for (const height of heights) {
      const block = await this.publicClient.getBlock({ blockNumber: BigInt(height) });
      if (block?.hash === state.blockHashes[String(height)]) break; // ancestors are canonical too
      lowestMismatch = height;
    }
    return lowestMismatch;
  }

  /** Keep the hash window bounded (reorg protection depth ≈ 4x lookback). */
  private pruneBlockHashes(state: IndexerSourceState): void {
    const floor = state.lastProcessedBlock - Math.max(this.lookbackBlocks * 4, 32);
    for (const heightKey of Object.keys(state.blockHashes)) {
      if (Number(heightKey) < floor) delete state.blockHashes[heightKey];
    }
  }

  private recordError(error: unknown, sourceKey?: string): void {
    const message = error instanceof Error ? error.message : String(error);
    this.lastError = sourceKey ? `[${sourceKey}] ${message}` : message;
    this.lastErrorAt = new Date().toISOString();
    this.logger.error(`Indexer poll error${sourceKey ? ` (${sourceKey})` : ""}: ${message}`);
  }

  // ── read API ──────────────────────────────────────────────────────────────

  getMetrics(): IndexerMetrics {
    const sources: IndexerMetrics["sources"] = {};
    let minProcessed: number | null = null;
    for (const [key, config] of this.sources.entries()) {
      const lastProcessedBlock = this.lastProcessed.get(key) ?? null;
      sources[key] = {
        address: config.address,
        fromBlock: config.fromBlock,
        lastProcessedBlock,
        eventsIndexed: this.eventsIndexed.get(key) ?? 0,
      };
      if (lastProcessedBlock !== null) {
        minProcessed =
          minProcessed === null ? lastProcessedBlock : Math.min(minProcessed, lastProcessedBlock);
      }
    }
    const lagBlocks =
      this.latestBlock !== null && minProcessed !== null
        ? Math.max(0, this.latestBlock - minProcessed)
        : 0;
    return {
      running: this.timer !== null,
      pollIntervalMs: this.pollIntervalMs,
      lookbackBlocks: this.lookbackBlocks,
      sourceCount: this.sources.size,
      latestBlock: this.latestBlock,
      lagBlocks,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      reconnectCount: this.reconnectCount,
      totalPolls: this.totalPolls,
      reorgCount: this.reorgCount,
      sources,
    };
  }

  async queryEvents(options: { source?: string; limit?: number; offset?: number }): Promise<{
    source: string | null;
    limit: number;
    offset: number;
    total: number;
    events: IndexedEventRecord[];
  }> {
    const limit = Math.min(Math.max(Math.floor(options.limit ?? 50), 1), MAX_QUERY_LIMIT);
    const offset = Math.max(Math.floor(options.offset ?? 0), 0);
    const [events, total] = await Promise.all([
      this.persistence.getEvents({ source: options.source, limit, offset }),
      this.persistence.countEvents(options.source),
    ]);
    return { source: options.source ?? null, limit, offset, total, events };
  }
}
