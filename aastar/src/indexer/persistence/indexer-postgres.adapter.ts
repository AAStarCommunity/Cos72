import { Injectable } from "@nestjs/common";
import { DataSource, QueryRunner } from "typeorm";
import { IndexerPersistence } from "./indexer-persistence.interface";
import { IndexedEventRecord, IndexerSourceState } from "../indexer.types";

/** Minimal SQL executor shared by DataSource (autocommit) and QueryRunner (tx). */
type SqlExecutor = { query(sql: string, params?: any[]): Promise<any> };

/**
 * PostgreSQL persistence for the indexer (DB_TYPE=postgres).
 * Uses raw SQL over the global TypeORM DataSource (registered by
 * DatabaseModule.forRoot when DB_TYPE=postgres) so no entity has to be added
 * to the shared entity list. Tables are created lazily on first use.
 *
 * runInTransaction opens a real QueryRunner transaction and hands the callback
 * a tx-bound adapter, so reorg delete + rescan writes + state upsert commit or
 * roll back as one unit.
 */
@Injectable()
export class IndexerPostgresAdapter implements IndexerPersistence {
  private ready: Promise<void> | null = null;
  private readonly executor: SqlExecutor;

  constructor(
    private readonly dataSource: DataSource,
    txExecutor?: SqlExecutor
  ) {
    this.executor = txExecutor ?? dataSource;
  }

  private get isTxBound(): boolean {
    return this.executor !== this.dataSource;
  }

  private ensureTables(): Promise<void> {
    if (this.isTxBound) return Promise.resolve(); // parent adapter already ensured
    if (!this.ready) {
      this.ready = this.createTables().catch(err => {
        this.ready = null; // allow retry on next call
        throw err;
      });
    }
    return this.ready;
  }

  private async createTables(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS indexed_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        event_name TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        block_number BIGINT NOT NULL,
        block_hash TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        args JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // Query shapes: (source, newest first) and (global, newest first).
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_indexed_events_source_block_log
         ON indexed_events (source, block_number DESC, log_index DESC)`
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_indexed_events_block_log
         ON indexed_events (block_number DESC, log_index DESC)`
    );
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS indexer_state (
        source TEXT PRIMARY KEY,
        last_processed_block BIGINT NOT NULL,
        block_hashes JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  private rowToEvent(row: any): IndexedEventRecord {
    return {
      id: row.id,
      source: row.source,
      eventName: row.event_name,
      contractAddress: row.contract_address,
      blockNumber: Number(row.block_number),
      blockHash: row.block_hash,
      txHash: row.tx_hash,
      logIndex: Number(row.log_index),
      args: row.args ?? {},
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  // ── indexed_events ──────────────────────────────────────────────────────────

  async getEvents(filter: {
    source?: string;
    limit: number;
    offset?: number;
  }): Promise<IndexedEventRecord[]> {
    await this.ensureTables();
    const offset = filter.offset ?? 0;
    const params: any[] = [];
    let where = "";
    if (filter.source) {
      params.push(filter.source);
      where = `WHERE source = $${params.length}`;
    }
    params.push(filter.limit, offset);
    const rows = await this.executor.query(
      `SELECT * FROM indexed_events ${where}
       ORDER BY block_number DESC, log_index DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows.map((row: any) => this.rowToEvent(row));
  }

  async countEvents(source?: string): Promise<number> {
    await this.ensureTables();
    const rows = source
      ? await this.executor.query(
          `SELECT COUNT(*)::int AS count FROM indexed_events WHERE source = $1`,
          [source]
        )
      : await this.executor.query(`SELECT COUNT(*)::int AS count FROM indexed_events`);
    return rows[0]?.count ?? 0;
  }

  async hasEvent(id: string): Promise<boolean> {
    await this.ensureTables();
    const rows = await this.executor.query(`SELECT 1 FROM indexed_events WHERE id = $1`, [id]);
    return rows.length > 0;
  }

  async saveEvent(event: IndexedEventRecord): Promise<void> {
    await this.ensureTables();
    await this.executor.query(
      `INSERT INTO indexed_events
         (id, source, event_name, contract_address, block_number, block_hash, tx_hash, log_index, args, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.source,
        event.eventName,
        event.contractAddress,
        event.blockNumber,
        event.blockHash,
        event.txHash,
        event.logIndex,
        JSON.stringify(event.args),
        event.createdAt,
      ]
    );
  }

  async deleteEventsFromBlock(source: string, fromBlock: number): Promise<number> {
    await this.ensureTables();
    // RETURNING gives a deterministic row list regardless of how the driver
    // shapes DELETE results ([rows, rowCount] vs plain rows).
    const result = await this.executor.query(
      `DELETE FROM indexed_events WHERE source = $1 AND block_number >= $2 RETURNING id`,
      [source, fromBlock]
    );
    if (Array.isArray(result) && result.length === 2 && typeof result[1] === "number") {
      return result[1]; // TypeORM pg driver: [returnedRows, rowCount]
    }
    return Array.isArray(result) ? result.length : 0;
  }

  // ── indexer_state ───────────────────────────────────────────────────────────

  async getState(source: string): Promise<IndexerSourceState | null> {
    await this.ensureTables();
    const rows = await this.executor.query(`SELECT * FROM indexer_state WHERE source = $1`, [
      source,
    ]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      source: row.source,
      lastProcessedBlock: Number(row.last_processed_block),
      blockHashes: row.block_hashes ?? {},
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  async saveState(state: IndexerSourceState): Promise<void> {
    await this.ensureTables();
    await this.executor.query(
      `INSERT INTO indexer_state (source, last_processed_block, block_hashes, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source) DO UPDATE SET
         last_processed_block = EXCLUDED.last_processed_block,
         block_hashes = EXCLUDED.block_hashes,
         updated_at = EXCLUDED.updated_at`,
      [state.source, state.lastProcessedBlock, JSON.stringify(state.blockHashes), state.updatedAt]
    );
  }

  // ── transaction ─────────────────────────────────────────────────────────────

  async runInTransaction<T>(fn: (tx: IndexerPersistence) => Promise<T>): Promise<T> {
    if (this.isTxBound) return fn(this); // already inside a transaction

    await this.ensureTables();
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const txAdapter = new IndexerPostgresAdapter(this.dataSource, {
        query: (sql, params) => queryRunner.query(sql, params),
      });
      const result = await fn(txAdapter);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await queryRunner.release().catch(() => undefined);
    }
  }
}
