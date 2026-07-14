import type { Abi, Address } from "viem";

/**
 * Registration payload for an on-chain event source.
 * Future consumers (MyShop purchases, MyTask tasks, ...) register one of these
 * per contract they want indexed. The indexer itself ships with zero sources.
 */
export interface IndexerSourceConfig {
  /** Unique key identifying the source, e.g. "myshop-purchases". */
  key: string;
  /** Contract address to watch. */
  address: Address;
  /** Contract ABI (only its event items are used). */
  abi: Abi;
  /** Event names (from the ABI) to index. */
  events: string[];
  /** First block to scan from on a fresh state. */
  fromBlock: number;
}

/**
 * One indexed log, persisted in the `indexed_events` collection/table.
 * `id` = `${txHash}:${logIndex}` is the global dedup key.
 */
export interface IndexedEventRecord {
  id: string;
  source: string;
  eventName: string;
  contractAddress: string;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
  args: Record<string, unknown>;
  createdAt: string;
}

/**
 * Per-source cursor, persisted in the `indexer_state` collection/table.
 * `blockHashes` maps block height -> blockHash for recently observed blocks
 * (blocks that contained our logs + each poll's tip block); it powers reorg
 * detection and is pruned to a bounded window.
 */
export interface IndexerSourceState {
  source: string;
  lastProcessedBlock: number;
  blockHashes: Record<string, string>;
  updatedAt: string;
}

export interface IndexerSourceMetrics {
  address: string;
  fromBlock: number;
  lastProcessedBlock: number | null;
  eventsIndexed: number;
}

export interface IndexerMetrics {
  running: boolean;
  pollIntervalMs: number;
  lookbackBlocks: number;
  sourceCount: number;
  latestBlock: number | null;
  /** latestBlock - min(perSource lastProcessedBlock); 0 when idle or fully caught up. */
  lagBlocks: number;
  lastError: string | null;
  lastErrorAt: string | null;
  reconnectCount: number;
  totalPolls: number;
  reorgCount: number;
  sources: Record<string, IndexerSourceMetrics>;
}
