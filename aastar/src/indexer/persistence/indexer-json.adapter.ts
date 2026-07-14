import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { IndexerPersistence } from "./indexer-persistence.interface";
import { IndexedEventRecord, IndexerSourceState } from "../indexer.types";

const EVENTS_FILE = "indexed_events.json";
const STATE_FILE = "indexer_state.json";

/**
 * JSON-file persistence for the indexer (DB_TYPE=json).
 * Uses the same data-directory discovery as database/adapters/json.adapter.ts.
 */
@Injectable()
export class IndexerJsonAdapter implements IndexerPersistence {
  private readonly dataDir: string;
  /** Serializes writes so concurrent poll ticks cannot interleave read-modify-write. */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor() {
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

  private async readJSON<T>(filename: string, fallback: T): Promise<T> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return fallback;
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

  // ── indexed_events ──────────────────────────────────────────────────────────

  async getEvents(filter: {
    source?: string;
    limit: number;
    offset?: number;
  }): Promise<IndexedEventRecord[]> {
    const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
    const filtered = filter.source ? events.filter(e => e.source === filter.source) : events;
    // Newest first
    filtered.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    const offset = filter.offset ?? 0;
    return filtered.slice(offset, offset + filter.limit);
  }

  async countEvents(source?: string): Promise<number> {
    const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
    return source ? events.filter(e => e.source === source).length : events.length;
  }

  async hasEvent(id: string): Promise<boolean> {
    const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
    return events.some(e => e.id === id);
  }

  async saveEvent(event: IndexedEventRecord): Promise<void> {
    await this.enqueue(async () => {
      const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
      if (events.some(e => e.id === event.id)) return; // dedup safety net
      events.push(event);
      await this.writeJSON(EVENTS_FILE, events);
    });
  }

  async deleteEventsFromBlock(source: string, fromBlock: number): Promise<number> {
    return this.enqueue(async () => {
      const events = await this.readJSON<IndexedEventRecord[]>(EVENTS_FILE, []);
      const kept = events.filter(e => !(e.source === source && e.blockNumber >= fromBlock));
      const deleted = events.length - kept.length;
      if (deleted > 0) await this.writeJSON(EVENTS_FILE, kept);
      return deleted;
    });
  }

  // ── indexer_state ───────────────────────────────────────────────────────────

  async getState(source: string): Promise<IndexerSourceState | null> {
    const states = await this.readJSON<IndexerSourceState[]>(STATE_FILE, []);
    return states.find(s => s.source === source) ?? null;
  }

  async saveState(state: IndexerSourceState): Promise<void> {
    await this.enqueue(async () => {
      const states = await this.readJSON<IndexerSourceState[]>(STATE_FILE, []);
      const index = states.findIndex(s => s.source === state.source);
      if (index !== -1) states[index] = state;
      else states.push(state);
      await this.writeJSON(STATE_FILE, states);
    });
  }
}
