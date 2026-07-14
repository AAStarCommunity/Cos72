import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Address } from "viem";
import { IndexerService } from "../indexer/indexer.service";
import { IndexedEventRecord } from "../indexer/indexer.types";
import {
  BYTES32_RE,
  INDEX_PAGE_SIZE,
  MAX_SCAN_EVENTS,
  MYTASK_CHALLENGES_ABI,
  MYTASK_CHALLENGES_EVENT_NAMES,
  MYTASK_CHALLENGES_SOURCE,
  MYTASK_ESCROW_DEFAULT_ADDRESS,
  MYTASK_INDEX_DEFAULT_FROM_BLOCK,
} from "./mytask-index.constants";

/** One TaskChallenged occurrence, resolved to challenger + stake + provenance. */
export interface ChallengeEntry {
  taskId: string;
  challenger: string;
  /** Stake actually received by the escrow, as a decimal string (wei). */
  stake: string;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
}

/** Resolution of a challenge (ChallengeResolved), if one has been indexed. */
export interface ChallengeResolution {
  challengeAccepted: boolean;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

export interface TaskChallengesResult {
  taskId: string;
  challenges: ChallengeEntry[];
  resolution: ChallengeResolution | null;
  /** How many source events were scanned to build this answer. */
  scanned: number;
  /** Total events the indexer holds for this source. */
  total: number;
  /**
   * True when the MAX_SCAN_EVENTS cap was hit before exhausting the source, so
   * matching events (or a resolution) may exist in the un-scanned older window.
   * When true and `challenges` is empty, "not found" is NOT authoritative.
   */
  truncated: boolean;
}

export interface RecentChallengesResult {
  limit: number;
  challenges: ChallengeEntry[];
  /** How many source events were scanned. */
  scanned: number;
  /** Total events the indexer holds for this source. */
  total: number;
  /** True when the scan cap was hit before `limit` challenges were collected. */
  truncated: boolean;
}

/**
 * First consumer of the A-8 IndexerService: registers TaskEscrowV2's challenge
 * events as an indexer source and exposes read endpoints that answer "who
 * challenged task X" — data the contract does not expose (no public getter for
 * `_challengers`), so the on-chain event log is the only source (MT-11).
 *
 * Registration is opt-out: MYTASK_ESCROW_ADDRESS defaults to the deployed
 * TaskEscrowV2. It is skipped (with a log, never blocking boot) when the address
 * is explicitly cleared or invalid, or when no RPC URL is configured — matching
 * A-8's "no source ⇒ no RPC traffic" idle contract.
 */
@Injectable()
export class MyTaskIndexService implements OnModuleInit {
  private readonly logger = new Logger(MyTaskIndexService.name);
  private registered = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly indexerService: IndexerService
  ) {}

  onModuleInit(): void {
    // envOr default: the known deployed TaskEscrowV2. An explicit empty string
    // disables MyTask indexing.
    const rawAddress = this.configService.get<string>(
      "MYTASK_ESCROW_ADDRESS",
      MYTASK_ESCROW_DEFAULT_ADDRESS
    );
    const address = (rawAddress ?? "").trim();
    const rpcUrl = this.configService.get<string>("ethRpcUrl");

    if (!address) {
      this.logger.log("MyTask indexing skipped: MYTASK_ESCROW_ADDRESS is empty (disabled)");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      this.logger.warn(
        `MyTask indexing skipped: MYTASK_ESCROW_ADDRESS="${address}" is not a valid address`
      );
      return;
    }
    if (!rpcUrl) {
      // Align with A-8: without an RPC there is nothing to poll; don't register a
      // dead source. (ETH_RPC_URL is normally required, so this is defensive.)
      this.logger.warn("MyTask indexing skipped: no RPC URL configured (ethRpcUrl)");
      return;
    }

    // Idempotency: if the source is already registered (e.g. a re-init), adopt it
    // instead of calling registerSource again (which throws on a duplicate key).
    if (this.indexerService.hasSource(MYTASK_CHALLENGES_SOURCE)) {
      this.registered = true;
      this.logger.log("MyTask challenges source already registered; skipping re-registration");
      return;
    }

    const fromBlock = this.resolveFromBlock();
    try {
      this.indexerService.registerSource({
        key: MYTASK_CHALLENGES_SOURCE,
        address: address as Address,
        abi: MYTASK_CHALLENGES_ABI,
        events: MYTASK_CHALLENGES_EVENT_NAMES,
        fromBlock,
      });
      this.registered = true;
      this.logger.log(
        `MyTask challenges source registered (address=${address}, fromBlock=${fromBlock})`
      );
    } catch (error) {
      // A registration failure must not crash boot — the read endpoints will just
      // report an unregistered source.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register MyTask challenges source: ${message}`);
    }
  }

  /** Parse MYTASK_INDEX_FROM_BLOCK; fall back to the deployment block default. */
  private resolveFromBlock(): number {
    const raw = this.configService.get("MYTASK_INDEX_FROM_BLOCK");
    if (raw === undefined || raw === null || raw === "") return MYTASK_INDEX_DEFAULT_FROM_BLOCK;
    const value = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      this.logger.warn(
        `Invalid MYTASK_INDEX_FROM_BLOCK="${raw}"; using default ${MYTASK_INDEX_DEFAULT_FROM_BLOCK}`
      );
      return MYTASK_INDEX_DEFAULT_FROM_BLOCK;
    }
    return value;
  }

  /** Whether the MyTask challenge source is registered in the indexer. */
  isRegistered(): boolean {
    return this.registered && this.indexerService.hasSource(MYTASK_CHALLENGES_SOURCE);
  }

  /**
   * Guard the read paths: if the source was never registered (empty/invalid
   * address, no RPC, or a failed/duplicate registration), querying the indexer
   * would return an empty array indistinguishable from "no one challenged".
   * Surface that as 503 so callers never mistake "not indexed" for "no data".
   */
  private ensureRegistered(): void {
    if (!this.isRegistered()) {
      throw new ServiceUnavailableException("MyTask index source is not registered");
    }
  }

  /**
   * All challengers of a task, oldest-challenge-first, plus the resolution if
   * one has been indexed. taskId must be a 0x-prefixed bytes32; comparison is
   * case-insensitive (topics decode to lowercase hex).
   */
  async getChallengesByTaskId(taskId: string): Promise<TaskChallengesResult> {
    this.ensureRegistered();
    const normalized = taskId.toLowerCase();
    const { events: records, scanned, total, truncated } = await this.drainEvents();

    const challenges: ChallengeEntry[] = [];
    let resolution: ChallengeResolution | null = null;

    for (const record of records) {
      const recordTaskId = this.argString(record, "taskId").toLowerCase();
      if (recordTaskId !== normalized) continue;

      if (record.eventName === "TaskChallenged") {
        challenges.push(this.toChallengeEntry(record));
      } else if (record.eventName === "ChallengeResolved") {
        const candidate: ChallengeResolution = {
          challengeAccepted: this.argBool(record, "challengeAccepted"),
          blockNumber: record.blockNumber,
          txHash: record.txHash,
          logIndex: record.logIndex,
        };
        // Keep the latest resolution (highest block, then logIndex).
        if (
          !resolution ||
          candidate.blockNumber > resolution.blockNumber ||
          (candidate.blockNumber === resolution.blockNumber &&
            candidate.logIndex > resolution.logIndex)
        ) {
          resolution = candidate;
        }
      }
    }

    // Oldest challenge first for a stable, chronological UI list.
    challenges.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    return { taskId, challenges, resolution, scanned, total, truncated };
  }

  /** Most-recent challenges across all tasks, newest first, capped at `limit`. */
  async getRecentChallenges(limit: number): Promise<RecentChallengesResult> {
    this.ensureRegistered();
    // getEvents is newest-first; page forward, keeping only TaskChallenged, until
    // we have `limit` of them (resolutions consume slots so a single page of
    // `limit` events can under-fill). Bounded by MAX_SCAN_EVENTS.
    const challenges: ChallengeEntry[] = [];
    let scanned = 0;
    let total = 0;
    for (;;) {
      const { events, total: pageTotal } = await this.indexerService.queryEvents({
        source: MYTASK_CHALLENGES_SOURCE,
        limit: INDEX_PAGE_SIZE,
        offset: scanned,
      });
      total = pageTotal;
      for (const event of events) {
        scanned += 1;
        if (event.eventName !== "TaskChallenged") continue;
        challenges.push(this.toChallengeEntry(event));
        // Enough collected: the answer is complete regardless of un-scanned tail.
        if (challenges.length >= limit) {
          return { limit, challenges, scanned, total, truncated: false };
        }
      }
      if (events.length === 0 || scanned >= total || scanned >= MAX_SCAN_EVENTS) break;
    }
    // Fell short of `limit`: truncated only if the cap stopped us with more to scan.
    return { limit, challenges, scanned, total, truncated: scanned < total };
  }

  /**
   * Drain up to MAX_SCAN_EVENTS records for the source (A-8 has no arg-level
   * filter, so taskId filtering happens here). Pages in INDEX_PAGE_SIZE chunks.
   * `truncated` is true when the cap stopped us before the source was exhausted,
   * so an empty filter result is "maybe in the older window", not "definitely none".
   */
  private async drainEvents(): Promise<{
    events: IndexedEventRecord[];
    scanned: number;
    total: number;
    truncated: boolean;
  }> {
    const out: IndexedEventRecord[] = [];
    let scanned = 0;
    let total = 0;
    for (;;) {
      const { events, total: pageTotal } = await this.indexerService.queryEvents({
        source: MYTASK_CHALLENGES_SOURCE,
        limit: INDEX_PAGE_SIZE,
        offset: scanned,
      });
      total = pageTotal;
      out.push(...events);
      scanned += events.length;
      if (events.length === 0 || scanned >= total || scanned >= MAX_SCAN_EVENTS) break;
    }
    return { events: out, scanned, total, truncated: scanned < total };
  }

  private toChallengeEntry(record: IndexedEventRecord): ChallengeEntry {
    return {
      taskId: this.argString(record, "taskId"),
      challenger: this.argString(record, "challenger"),
      stake: this.argString(record, "stake"),
      blockNumber: record.blockNumber,
      blockHash: record.blockHash,
      txHash: record.txHash,
      logIndex: record.logIndex,
    };
  }

  private argString(record: IndexedEventRecord, key: string): string {
    const value = record.args?.[key];
    return value === undefined || value === null ? "" : String(value);
  }

  private argBool(record: IndexedEventRecord, key: string): boolean {
    const value = record.args?.[key];
    return value === true || value === "true";
  }

  /** Static bytes32 shape check reused by the controller. */
  static isBytes32(value: string): boolean {
    return BYTES32_RE.test(value);
  }
}
