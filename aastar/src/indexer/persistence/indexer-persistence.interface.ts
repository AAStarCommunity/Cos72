import { IndexedEventRecord, IndexerSourceState } from "../indexer.types";

/** DI token for the indexer persistence adapter (json | postgres, by DB_TYPE). */
export const INDEXER_PERSISTENCE = "INDEXER_PERSISTENCE";

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
}
