import { IndexedEventRecord, IndexerSourceState } from "../indexer.types";

/** DI token for the indexer persistence adapter (json | postgres, by DB_TYPE). */
export const INDEXER_PERSISTENCE = "INDEXER_PERSISTENCE";

/**
 * Thrown when the underlying store is corrupted or unreadable (parse errors,
 * permission failures, ...). The indexer treats this as NON-transient: the
 * affected source is disabled instead of retried, so a corrupted store is
 * never silently overwritten by the next poll's writes.
 */
export class IndexerPersistenceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "IndexerPersistenceError";
  }
}

/**
 * Indexer-scoped persistence abstraction, mirroring the app-wide
 * database/persistence.interface.ts json/postgres dual-adapter pattern.
 * Collections/tables: `indexed_events` and `indexer_state`.
 * (Kept separate so the shared PersistenceAdapter and its adapters stay untouched.)
 */
export interface IndexerPersistence {
  getEvents(filter: {
    source?: string;
    limit: number;
    offset?: number;
  }): Promise<IndexedEventRecord[]>;
  countEvents(source?: string): Promise<number>;
  hasEvent(id: string): Promise<boolean>;
  saveEvent(event: IndexedEventRecord): Promise<void>;
  /** Reorg rollback: delete all events of `source` at height >= fromBlock. Returns count deleted. */
  deleteEventsFromBlock(source: string, fromBlock: number): Promise<number>;

  getState(source: string): Promise<IndexerSourceState | null>;
  saveState(state: IndexerSourceState): Promise<void>;

  /**
   * Run `fn` atomically. All writes made through the `tx` handle either all
   * become visible or none do:
   * - postgres: a real database transaction (QueryRunner commit/rollback);
   * - json: a buffered snapshot — writes are staged in memory and flushed
   *   atomically (tmp + rename) only if `fn` resolves.
   * Used to make "reorg delete + rescan writes + state upsert" one atomic step.
   */
  runInTransaction<T>(fn: (tx: IndexerPersistence) => Promise<T>): Promise<T>;
}
