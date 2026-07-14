import type { AbiEvent } from "viem";

/**
 * Indexer source key for MyTask challenge events. Stable public identifier used
 * by IndexerService.registerSource / queryEvents and the /mytask/challenges read
 * endpoints. Do not rename without a persistence migration (it keys the cursor).
 */
export const MYTASK_CHALLENGES_SOURCE = "mytask-challenges";

/**
 * TaskEscrowV2 default address (MT-8 redeploy, Sepolia, verified on-chain).
 * Overridable via env MYTASK_ESCROW_ADDRESS. Set the env to an empty string to
 * disable MyTask indexing entirely (the source is then skipped at init).
 * Source of truth: ~/Dev/mycelium/MyTask/contracts + broadcast/DeploySepolia.
 */
export const MYTASK_ESCROW_DEFAULT_ADDRESS = "0x171234DD282eF2909ec20dafC3F81deBa6761178";

/**
 * Default first block to scan. This is the TaskEscrowV2 deployment block on
 * Sepolia (from broadcast/DeploySepolia.s.sol/11155111/run-latest.json receipt),
 * so the indexer never wastes RPC scanning pre-deployment history. Override via
 * env MYTASK_INDEX_FROM_BLOCK; if a fresh redeploy moves the contract, update
 * this to the new deployment block to keep catch-up cheap.
 */
export const MYTASK_INDEX_DEFAULT_FROM_BLOCK = 11269271;

/**
 * Event ABI fragments — copied 1:1 from TaskEscrowV2.sol so viem decodes the
 * indexed topics and data correctly. A single wrong name/type/indexed flag
 * silently breaks decoding, so these must mirror the contract exactly:
 *
 *   event TaskChallenged(bytes32 indexed taskId, address indexed challenger, uint256 stake);
 *   event ChallengeResolved(bytes32 indexed taskId, bool challengeAccepted);
 */
export const TASK_CHALLENGED_EVENT = {
  type: "event",
  name: "TaskChallenged",
  inputs: [
    { name: "taskId", type: "bytes32", indexed: true },
    { name: "challenger", type: "address", indexed: true },
    { name: "stake", type: "uint256", indexed: false },
  ],
} as const satisfies AbiEvent;

export const CHALLENGE_RESOLVED_EVENT = {
  type: "event",
  name: "ChallengeResolved",
  inputs: [
    { name: "taskId", type: "bytes32", indexed: true },
    { name: "challengeAccepted", type: "bool", indexed: false },
  ],
} as const satisfies AbiEvent;

/** ABI passed to the indexer source (only its event items are used). */
export const MYTASK_CHALLENGES_ABI = [TASK_CHALLENGED_EVENT, CHALLENGE_RESOLVED_EVENT];

export const MYTASK_CHALLENGES_EVENT_NAMES = ["TaskChallenged", "ChallengeResolved"];

/** bytes32 hex (0x + 64 hex chars) — the taskId query-param shape. */
export const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

/** Upper bound for the recent-challenges list (mirrors indexer's clamp style). */
export const MAX_RECENT_LIMIT = 100;
export const DEFAULT_RECENT_LIMIT = 20;

/** Page size when draining the indexer (matches IndexerService MAX_QUERY_LIMIT). */
export const INDEX_PAGE_SIZE = 200;

/**
 * Safety cap on how many events we drain from the indexer for an in-module
 * filter/scan. A-8's getEvents has no arg-level (taskId) filter, so we page and
 * filter here; this bounds the work if the source grows very large.
 */
export const MAX_SCAN_EVENTS = 5000;
