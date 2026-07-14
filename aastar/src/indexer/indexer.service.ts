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
  IndexerPersistenceError,
} from "./persistence/indexer-persistence.interface";

const DEFAULT_POLL_MS = 12_000;
const DEFAULT_LOOKBACK_BLOCKS = 12;
const DEFAULT_SCAN_WINDOW_BLOCKS = 5_000;
const MAX_QUERY_LIMIT = 200;
const MAX_BACKOFF_MS = 300_000; // 5 min cap on error backoff
const MAX_SPLIT_DEPTH = 4; // getLogs adaptive split: window / 2^4 minimum

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

/** Parse an env-configurable integer; fail fast on anything not a bounded finite integer. */
function readBoundedInt(
  configService: ConfigService,
  key: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const raw = configService.get(key);
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Invalid ${key}="${raw}": must be an integer in [${min}, ${max}] (default ${defaultValue})`
    );
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
 * - Chunked scanning: ranges are scanned in INDEXER_SCAN_WINDOW (default 5000)
 *   block chunks, each committed atomically with its cursor advance, so long
 *   downtime / old fromBlock catch-up survives RPC range limits and crashes.
 * - Dedup: `txHash:logIndex` unique key; rescanned hits are skipped.
 * - Reorg rollback: block hashes of observed blocks (log blocks + poll tips)
 *   are recorded per source; a hash change at a recorded height deletes all
 *   events at/after that height and rewinds the cursor — delete, rescan writes
 *   and state upsert commit as ONE transaction (runInTransaction).
 * - Errors: transient errors back off exponentially (capped 5 min) and clear
 *   on the next success; persistence corruption disables the affected source.
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
  private readonly disabledSources = new Map<string, string>(); // key -> reason
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private stopping = false;
  private currentPoll: Promise<void> | null = null;
  private needsReconnect = false;

  private pollIntervalMs = DEFAULT_POLL_MS;
  private lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS;
  private scanWindowBlocks = DEFAULT_SCAN_WINDOW_BLOCKS;

  // ── metrics state ─────────────────────────────────────────────────────────
  private latestBlock: number | null = null;
  private currentError: string | null = null;
  private lastError: string | null = null;
  private lastErrorAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveErrors = 0;
  private backoffUntil = 0; // epoch ms; timer ticks before this are skipped
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
    if (this.timer) return; // idempotent: never leak a second interval
    // Fail fast on malformed env (NaN / zero / negative would hot-loop or throw in BigInt()).
    this.pollIntervalMs = readBoundedInt(
      this.configService,
      "INDEXER_POLL_MS",
      DEFAULT_POLL_MS,
      1_000,
      3_600_000
    );
    this.lookbackBlocks = readBoundedInt(
      this.configService,
      "INDEXER_LOOKBACK_BLOCKS",
      DEFAULT_LOOKBACK_BLOCKS,
      0,
      10_000
    );
    this.scanWindowBlocks = readBoundedInt(
      this.configService,
      "INDEXER_SCAN_WINDOW",
      DEFAULT_SCAN_WINDOW_BLOCKS,
      10,
      1_000_000
    );
    this.stopping = false;
    this.createClient();
    this.timer = setInterval(() => void this.pollTick(), this.pollIntervalMs);
    // Do not keep the process alive just for the indexer.
    if (typeof this.timer.unref === "function") this.timer.unref();
    this.logger.log(
      `Indexer started (pollIntervalMs=${this.pollIntervalMs}, lookbackBlocks=${this.lookbackBlocks}, scanWindow=${this.scanWindowBlocks}, sources=0)`
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Wait for an in-flight poll so shutdown never races a half-written round.
    if (this.currentPoll) {
      await this.currentPoll.catch(() => undefined);
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
    if (!Number.isInteger(config.fromBlock) || config.fromBlock < 0) {
      throw new Error(`Indexer source ${config.key} requires a non-negative integer fromBlock`);
    }
    const known = new Set(
      config.abi.filter(item => item.type === "event").map(item => (item as AbiEvent).name)
    );
    const missing = config.events.filter(name => !known.has(name));
    if (missing.length > 0) {
      throw new Error(`Indexer source ${config.key}: events not in ABI: ${missing.join(", ")}`);
    }
    this.sources.set(config.key, { ...config });
    this.eventsIndexed.set(config.key, this.eventsIndexed.get(config.key) ?? 0);
    this.logger.log(
      `Registered indexer source "${config.key}" (${config.address}, events=[${config.events.join(", ")}], fromBlock=${config.fromBlock})`
    );
  }

  /** Whether a source key is registered (used by the controller for 400s). */
  hasSource(key: string): boolean {
    return this.sources.has(key);
  }

  // ── poll loop ─────────────────────────────────────────────────────────────

  /** Timer entrypoint: respects error backoff. Manual pollOnce() does not. */
  private pollTick(): void {
    if (Date.now() < this.backoffUntil) return;
    void this.pollOnce();
  }

  /** One poll round. Public so consumers/tests can force a tick (skips backoff). */
  async pollOnce(): Promise<void> {
    if (this.polling || this.stopping) return; // in-flight mutual exclusion
    if (this.activeSources().length === 0) return; // pure idle: no sources, no RPC
    this.polling = true;
    this.totalPolls += 1;
    this.currentPoll = this.doPoll();
    try {
      await this.currentPoll;
    } finally {
      this.polling = false;
      this.currentPoll = null;
    }
  }

  private activeSources(): IndexerSourceConfig[] {
    return [...this.sources.values()].filter(s => !this.disabledSources.has(s.key));
  }

  private async doPoll(): Promise<void> {
    let roundFailed = false;
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
      for (const source of this.activeSources()) {
        if (this.stopping) return;
        const ok = await this.pollSource(source, latest, tipBlock?.hash ?? null);
        if (!ok) roundFailed = true;
      }
    } catch (error) {
      this.recordError(error);
      this.needsReconnect = true;
      roundFailed = true;
    }

    if (roundFailed) {
      this.applyBackoff();
    } else {
      // Success: clear transient error state (lastError stays for post-mortem).
      this.currentError = null;
      this.consecutiveErrors = 0;
      this.backoffUntil = 0;
      this.lastSuccessAt = new Date().toISOString();
    }
  }

  /** Exponential backoff for timer-driven polls: interval * 2^errors, capped. */
  private applyBackoff(): void {
    this.consecutiveErrors += 1;
    const backoffMs = Math.min(
      this.pollIntervalMs * Math.pow(2, this.consecutiveErrors - 1),
      MAX_BACKOFF_MS
    );
    this.backoffUntil = Date.now() + backoffMs;
    this.logger.warn(
      `Backing off ${backoffMs}ms after ${this.consecutiveErrors} consecutive failed round(s)`
    );
  }

  /** Returns false when this source's round failed (drives backoff). */
  private async pollSource(
    source: IndexerSourceConfig,
    latest: number,
    tipHash: string | null
  ): Promise<boolean> {
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
        for (const heightKey of Object.keys(state.blockHashes)) {
          if (Number(heightKey) >= reorgHeight) delete state.blockHashes[heightKey];
        }
        state.lastProcessedBlock = Math.max(source.fromBlock - 1, reorgHeight - 1);
        this.reorgCount += 1;
      }

      // Replay lookback: rescan the tail window every round.
      const scanFrom = Math.max(source.fromBlock, state.lastProcessedBlock - this.lookbackBlocks);
      if (scanFrom > latest) return true; // chain has not reached fromBlock yet

      const eventAbis = source.abi.filter(
        item => item.type === "event" && source.events.includes((item as AbiEvent).name)
      ) as AbiEvent[];

      // Chunked scan: each chunk's writes + cursor advance commit atomically,
      // so a crash mid-catch-up resumes from the last committed chunk.
      let chunkStart = scanFrom;
      let firstChunk = true;
      while (chunkStart <= latest) {
        if (this.stopping) return true;
        const chunkEnd = Math.min(chunkStart + this.scanWindowBlocks - 1, latest);
        const logs = await this.getLogsAdaptive(source, eventAbis, chunkStart, chunkEnd);

        const applyReorgDelete = firstChunk && reorgHeight !== null;
        const newCount = await this.persistence.runInTransaction(async tx => {
          if (applyReorgDelete) {
            const dropped = await tx.deleteEventsFromBlock(source.key, reorgHeight);
            this.logger.warn(
              `[${source.key}] reorg detected at block ${reorgHeight}: dropped ${dropped} event(s), rescanning`
            );
          }
          let saved = 0;
          for (const log of logs) {
            const blockNumber = Number(log.blockNumber);
            if (log.blockHash) state.blockHashes[String(blockNumber)] = log.blockHash;

            const id = `${log.transactionHash}:${Number(log.logIndex)}`;
            if (await tx.hasEvent(id)) continue; // dedup: rescan hit

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
            await tx.saveEvent(record);
            saved += 1;
          }

          if (chunkEnd === latest && tipHash) state.blockHashes[String(latest)] = tipHash;
          state.lastProcessedBlock = chunkEnd;
          this.pruneBlockHashes(state);
          state.updatedAt = new Date().toISOString();
          await tx.saveState(state);
          return saved;
        });

        this.lastProcessed.set(source.key, chunkEnd);
        if (newCount > 0) {
          this.eventsIndexed.set(source.key, (this.eventsIndexed.get(source.key) ?? 0) + newCount);
          this.logger.log(
            `[${source.key}] indexed ${newCount} new event(s) in blocks ${chunkStart}-${chunkEnd}`
          );
        }
        firstChunk = false;
        chunkStart = chunkEnd + 1;
      }
      return true;
    } catch (error) {
      this.recordError(error, source.key);
      if (error instanceof IndexerPersistenceError) {
        // Non-transient: retrying would risk overwriting a corrupted store.
        this.disabledSources.set(source.key, error.message);
        this.logger.error(
          `[${source.key}] persistence corruption — source DISABLED until operator intervention: ${error.message}`
        );
      } else {
        this.needsReconnect = true;
      }
      return false;
    }
  }

  /**
   * getLogs with shrink-on-failure: if the RPC rejects a range (too large /
   * too many results), split it in half and retry each half, up to
   * MAX_SPLIT_DEPTH levels; the final failure propagates.
   */
  private async getLogsAdaptive(
    source: IndexerSourceConfig,
    eventAbis: AbiEvent[],
    fromBlock: number,
    toBlock: number,
    depth = 0
  ): Promise<any[]> {
    try {
      return await this.publicClient.getLogs({
        address: source.address,
        events: eventAbis,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });
    } catch (error) {
      if (depth >= MAX_SPLIT_DEPTH || fromBlock >= toBlock) throw error;
      const mid = Math.floor((fromBlock + toBlock) / 2);
      this.logger.warn(
        `[${source.key}] getLogs ${fromBlock}-${toBlock} failed, splitting (depth ${depth + 1})`
      );
      const lower = await this.getLogsAdaptive(source, eventAbis, fromBlock, mid, depth + 1);
      const upper = await this.getLogsAdaptive(source, eventAbis, mid + 1, toBlock, depth + 1);
      return [...lower, ...upper];
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
    this.currentError = sourceKey ? `[${sourceKey}] ${message}` : message;
    this.lastError = this.currentError;
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
        status: this.disabledSources.has(key) ? "disabled" : "active",
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
      scanWindowBlocks: this.scanWindowBlocks,
      sourceCount: this.sources.size,
      latestBlock: this.latestBlock,
      lagBlocks,
      currentError: this.currentError,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      lastSuccessAt: this.lastSuccessAt,
      consecutiveErrors: this.consecutiveErrors,
      backoffUntil: this.backoffUntil > 0 ? this.backoffUntil : null,
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
