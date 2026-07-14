// Mirrors TaskEscrowV2.sol TaskStatus enum
export enum TaskStatus {
  Open = 0,
  Accepted = 1,
  InProgress = 2,
  Submitted = 3,
  Challenged = 4,
  Finalized = 5,
  Refunded = 6,
  Disputed = 7,
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Open]: "Open",
  [TaskStatus.Accepted]: "Accepted",
  [TaskStatus.InProgress]: "In Progress",
  [TaskStatus.Submitted]: "Submitted",
  [TaskStatus.Challenged]: "Challenged",
  [TaskStatus.Finalized]: "Completed",
  [TaskStatus.Refunded]: "Refunded",
  [TaskStatus.Disputed]: "Disputed",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Open]: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  [TaskStatus.Accepted]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  [TaskStatus.InProgress]:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  [TaskStatus.Submitted]:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  [TaskStatus.Challenged]:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  [TaskStatus.Finalized]: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  [TaskStatus.Refunded]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  [TaskStatus.Disputed]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Mirrors TaskEscrowV2.sol Task struct
export interface Task {
  taskId: `0x${string}`;
  community: `0x${string}`;
  taskor: `0x${string}`;
  supplier: `0x${string}`;
  token: `0x${string}`;
  reward: bigint;
  supplierFee: bigint;
  deadline: bigint;
  createdAt: bigint;
  challengeDeadline: bigint;
  challengeStake: bigint;
  status: TaskStatus;
  metadataUri: string;
  evidenceUri: string;
  taskType: `0x${string}`;
  juryTaskHash: `0x${string}`;
}

// Parsed task for UI display (human-readable fields)
export interface ParsedTask {
  taskId: string;
  community: string;
  taskor: string;
  supplier: string;
  token: string;
  reward: bigint;
  rewardFormatted: string;
  supplierFee: bigint;
  deadline: Date;
  createdAt: Date;
  challengeDeadline: Date | null;
  challengeStake: bigint;
  status: TaskStatus;
  statusLabel: string;
  metadataUri: string;
  evidenceUri: string;
  taskType: string;
  taskTypeLabel: string;
  juryTaskHash: `0x${string}`;
  isExpired: boolean;
  canFinalize: boolean;
  /** Submitted and still inside the challenge window (community may challengeWork). */
  canChallenge: boolean;
}

export interface CreateTaskForm {
  title: string;
  description: string;
  rewardAmount: string;
  deadlineDays: number;
  taskType: `0x${string}`;
}

export interface SubmitEvidenceForm {
  evidenceUri: string;
  description: string;
}

// Metadata stored in IPFS / onchain URI (JSON)
export interface TaskMetadata {
  title: string;
  description: string;
  requirements?: string;
  tags?: string[];
  createdAt: number;
}

// ====== MT-11: Jury / arbitration types (JuryContract.sol) ======

// Mirrors IJuryContract.TaskStatus
export enum JuryTaskStatus {
  Pending = 0,
  InProgress = 1,
  Completed = 2,
  Disputed = 3,
  Cancelled = 4,
}

// Mirrors IJuryContract.Task (raw chain shape)
export interface JuryTask {
  agentId: bigint;
  taskHash: `0x${string}`;
  evidenceUri: string;
  taskType: number;
  reward: bigint;
  deadline: bigint;
  status: JuryTaskStatus;
  minJurors: bigint;
  consensusThreshold: bigint;
  totalVotes: bigint;
  positiveVotes: bigint;
  finalResponse: number;
}

// Mirrors IJuryContract.Vote
export interface JuryVote {
  juror: `0x${string}`;
  response: number;
  reasoning: string;
  timestamp: bigint;
  slashed: boolean;
}

/** Per-tag validation requirement on the escrow (read-only display). */
export interface ValidationRequirementView {
  tag: `0x${string}`;
  minCount: bigint;
  minAvgResponse: number;
  minUniqueValidators: number;
  enabled: boolean;
}

/** Challenge stake config read from the escrow (ERC-20, e.g. xPNT). */
export interface ChallengeStakeConfig {
  token: `0x${string}`;
  amount: bigint;
  symbol: string;
  decimals: number;
}

/** Jury staking config (registerJuror): stakingToken + minStake. */
export interface JuryStakingInfo {
  token: `0x${string}`;
  minStake: bigint;
  symbol: string;
  decimals: number;
}
