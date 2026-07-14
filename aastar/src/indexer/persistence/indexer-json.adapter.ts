import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { IndexerPersistence, IndexerPersistenceError } from "./indexer-persistence.interface";
import { IndexedEventRecord, IndexerSourceState } from "../indexer.types";

const EVENTS_FILE = "indexed_events.json";
const STATE_FILE = "indexer_state.json";

interface Snapshot {
  events: IndexedEventRecord[];
  states: IndexerSourceState[];
}

/**
 * In-memory IndexerPersistence over a mutable snapshot. Used as the `tx`
 * handle inside runInTransaction: writes stage on the snapshot and are only
 * flushed to disk (atomically) if the transaction callback resolves.
 */
class SnapshotTx implements IndexerPersistence {
  constructor(private readonly snapshot: Snapshot) {}

  async getEvents(filter: { source?: string; limit: number; offset?: number }) {
    const filtered = filter.source
      ? this.snapshot.events.filter(e => e.source === filter.source)
      : [...this.snapshot.events];
    filtered.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    const offset = filter.offset ?? 0;
    return filtered.slice(offset, offset + filter.limit);
  }

  async countEvents(source?: string) {
    return source
      ? this.snapshot.events.filter(e => e.source === source).length
      : this.snapshot.events.length;
  }

  async hasEvent(id: string) {
    return this.snapshot.events.some(e => e.id === id);
  }

  async saveEvent(event: IndexedEventRecord) {
    if (this.snapshot.events.some(e => e.id === event.id)) return; // dedup safety net
    this.snapshot.events.push(event);
  }

  async deleteEventsFromBlock(source: string, fromBlock: number) {
    const before = this.snapshot.events.length;
    this.snapshot.events = this.snapshot.events.filter(
      e => !(e.source === source && e.blockNumber >= fromBlock)
    );
    return before - this.snapshot.events.length;
  }

  async getState(source: string) {
    return this.snapshot.states.find(s => s.source === source) ?? null;
  }

  async saveState(state: IndexerSourceState) {
    const index = this.snapshot.states.findIndex(s => s.source === state.source);
    if (index !== -1) this.snapshot.states[index] = state;
    else this.snapshot.states.push(state);
  }

  async runInTransaction<T>(fn: (tx: IndexerPersistence) => Promise<T>): Promise<T> {
    return fn(this); // already inside a transaction
  }
}

/**
 * JSON-file persistence for the indexer (DB_TYPE=json).
 * Uses the same data-directory discovery as database/adapters/json.adapter.ts.
 *
 * Corruption safety: only ENOENT is treated as "empty store". Any other read
 * failure (JSON parse error, permission denied, ...) throws
 * IndexerPersistenceError so a damaged file is never overwritten by later
 * writes — the service disables the affected source instead.
 */
@Injectable()
export class IndexerJsonAdapter implements IndexerPersistence {
  private readonly logger = new Logger(IndexerJsonAdapter.name);
  private readonly dataDir: string;
  /** Serializes writes so concurrent poll ticks cannot interleave read-modify-write. */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(dataDirOverride?: string) {
    if (dataDirOverride) {
      this.dataDir = dataDirOverride;
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    } else {
      const possiblePaths = [
        path.join(process.cwd(), "data"),
        path.join(process.cwd(), "aastar", "data"),
        path.join(__dirname, "..", "..", "..", "..", "data"),
        path.join(__dirname, "..", "..", "..", "data"),
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          this.dataDir = possiblePath;
          break;
        }
      }

      if (!this.dataDir) {
        this.dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(this.dataDir)) {
          fs.mkdirSync(this.dataDir, { recursive: true });
        }
      }
    }

    this.cleanupTmpLeftovers();
  }

  /**
   * A leftover `.tmp` means a previous write crashed between write and rename.
   * The main file is still the last consistent snapshot (rename is atomic),
   * so the partial tmp file is safe to discard — but loudly.
   */
  private cleanupTmpLeftovers(): void {
    for (const filename of [EVENTS_FILE, STATE_FILE]) {
      const tmpPath = path.join(this.dataDir, `${filename}.tmp`);
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
          this.logger.warn(
            `Removed leftover ${filename}.tmp (crashed mid-write; main file is the last consistent snapshot)`
          );
        }
      } catch (error) {
        this.logger.warn(`Could not inspect/remove ${tmpPath}: ${error}`);
      }
    }
  }

  private async readJSON<T>(filename: string, fallback: T): Promise<T> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error: any) {
      if (error?.code === "ENOENT") return fallback; // missing file = empty store
      throw new IndexerPersistenceError(
        `Failed to read ${filename} (corrupted or unreadable): ${error?.message ?? error}`,
        error
      );
    }
  }

  private async writeJSON(filename: string, data: unknown): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    const tmpPath = `${filePath}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.promises.rename(tmpPath, filePath);
  }

  /** Run a read-modify-write section exclusively. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(task, task);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  private async loadSnapshot(): Promise<Snapshot> {
    return {
      events: await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []),
      states: await this.readJSON<IndexerSourceState[]>(STATE_FILE, []),
    };
  }

  /**
   * Flush order matters for crash-recovery: events first, state second. If we
   * crash between the two writes, the old state (cursor + blockHashes) is
   * retained, so the next poll re-detects the same reorg / re-runs the same
   * lookback window and converges (dedup absorbs the replayed writes).
   */
  private async flushSnapshot(snapshot: Snapshot): Promise<void> {
    await this.writeJSON(EVENTS_FILE, snapshot.events);
    await this.writeJSON(STATE_FILE, snapshot.states);
  }

  // ── indexed_events ──────────────────────────────────────────────────────────

  async getEvents(filter: {
    source?: string;
    limit: number;
    offset?: number;
  }): Promise<IndexedEventRecord[]> {
    return new SnapshotTx(await this.loadSnapshot()).getEvents(filter);
  }

  async countEvents(source?: string): Promise<number> {
    return new SnapshotTx(await this.loadSnapshot()).countEvents(source);
  }

  async hasEvent(id: string): Promise<boolean> {
    const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
    return events.some(e => e.id === id);
  }

  async saveEvent(event: IndexedEventRecord): Promise<void> {
    await this.runInTransaction(tx => tx.saveEvent(event));
  }

  async deleteEventsFromBlock(source: string, fromBlock: number): Promise<number> {
    return this.runInTransaction(tx => tx.deleteEventsFromBlock(source, fromBlock));
  }

  // ── indexer_state ───────────────────────────────────────────────────────────

  async getState(source: string): Promise<IndexerSourceState | null> {
    const states = await this.readJSON<IndexerSourceState[]>(STATE_FILE, []);
    return states.find(s => s.source === source) ?? null;
  }

  async saveState(state: IndexerSourceState): Promise<void> {
    await this.runInTransaction(tx => tx.saveState(state));
  }

  // ── transaction ─────────────────────────────────────────────────────────────

  async runInTransaction<T>(fn: (tx: IndexerPersistence) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const snapshot = await this.loadSnapshot(); // throws on corruption — nothing overwritten
      const result = await fn(new SnapshotTx(snapshot));
      await this.flushSnapshot(snapshot); // only reached if fn resolved
      return result;
    });
  }
}
