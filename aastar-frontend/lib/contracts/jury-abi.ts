/**
 * JuryContract ABI (MT-11) — hand-copied from
 * ~/Dev/mycelium/MyTask/contracts/src/JuryContract.sol (Sepolia redeploy).
 *
 * Only the surface the frontend uses: juror lifecycle (registerJuror /
 * unregisterJuror / isActiveJuror), voting (vote / finalizeTask), the pull-mode
 * reward pool (pendingRewards / claimRewards) and read helpers. Staking is an
 * ERC-20 `transferFrom` (stakingToken = xPNT), so registration is a two-op
 * approve + registerJuror flow, same as the reward-escrow approve + createTask.
 */
export const JURY_CONTRACT_ABI = [
  // ====== Juror lifecycle ======
  {
    name: "registerJuror",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "stakeAmount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "unregisterJuror",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "isActiveJuror",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "juror", type: "address" }],
    outputs: [
      { name: "isActive", type: "bool" },
      { name: "stake", type: "uint256" },
    ],
  },
  // ====== Voting ======
  {
    name: "vote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskHash", type: "bytes32" },
      { name: "response", type: "uint8" },
      { name: "reasoning", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "finalizeTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskHash", type: "bytes32" }],
    outputs: [],
  },
  // ====== Reward pool (pull pattern) ======
  {
    name: "pendingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "juror", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimRewards",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  // ====== Views ======
  {
    name: "getTask",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskHash", type: "bytes32" }],
    outputs: [
      {
        name: "task",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "taskHash", type: "bytes32" },
          { name: "evidenceUri", type: "string" },
          { name: "taskType", type: "uint8" },
          { name: "reward", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "minJurors", type: "uint256" },
          { name: "consensusThreshold", type: "uint256" },
          { name: "totalVotes", type: "uint256" },
          { name: "positiveVotes", type: "uint256" },
          { name: "finalResponse", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskHash", type: "bytes32" }],
    outputs: [
      {
        name: "votes",
        type: "tuple[]",
        components: [
          { name: "juror", type: "address" },
          { name: "response", type: "uint8" },
          { name: "reasoning", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "slashed", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getMinJurorStake",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "minStake", type: "uint256" }],
  },
  {
    name: "getStakingToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "token", type: "address" }],
  },
  // ====== Events ======
  {
    name: "JurorRegistered",
    type: "event",
    inputs: [
      { name: "juror", type: "address", indexed: true },
      { name: "stakeAmount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JurorVoted",
    type: "event",
    inputs: [
      { name: "taskHash", type: "bytes32", indexed: true },
      { name: "juror", type: "address", indexed: true },
      { name: "response", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "TaskFinalized",
    type: "event",
    inputs: [
      { name: "taskHash", type: "bytes32", indexed: true },
      { name: "finalResponse", type: "uint8", indexed: false },
      { name: "totalVotes", type: "uint256", indexed: false },
      { name: "positiveVotes", type: "uint256", indexed: false },
    ],
  },
  {
    name: "RewardClaimed",
    type: "event",
    inputs: [
      { name: "juror", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
