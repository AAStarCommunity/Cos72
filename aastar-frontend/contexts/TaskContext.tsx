"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { parseUnits, formatUnits, keccak256, toBytes, type PublicClient } from "viem";
import { TASK_ESCROW_ABI, ERC20_ABI } from "@/lib/contracts/task-escrow-abi";
import { JURY_CONTRACT_ABI } from "@/lib/contracts/jury-abi";
import {
  TASK_ESCROW_ADDRESS,
  JURY_CONTRACT_ADDRESS,
  DEFAULT_REWARD_TOKEN,
  DEFAULT_REWARD_TOKEN_DECIMALS,
  TASK_TYPE_LABELS,
  isContractsConfigured,
  isJuryConfigured,
  getPublicClient,
} from "@/lib/contracts/task-config";
import type { ContractCall } from "@/lib/sdk/cosTx";
import {
  type Task,
  type ParsedTask,
  type CreateTaskForm,
  type JuryTask,
  type JuryVote,
  type ValidationRequirementView,
  type ChallengeStakeConfig,
  type JuryStakingInfo,
  TaskStatus,
  TASK_STATUS_LABELS,
} from "@/lib/task-types";

/** keccak256("TaskCreated(bytes32,address,address,uint256)") — used to verify the
 *  emitting event (topic0), not just the emitting address, when reading a receipt. */
const TASK_CREATED_TOPIC = keccak256(toBytes("TaskCreated(bytes32,address,address,uint256)"));

/**
 * Every write goes through the Cos72 session's gasless `send` (cosSend). It
 * resolves once the sponsored UserOp is mined (cosSend polls for the tx hash),
 * so callers get the on-chain tx hash back and no longer manage a walletClient
 * or an EOA. Pass `useCos72Session().send` into any write below.
 */
type SendFn = (call: ContractCall) => Promise<`0x${string}`>;

interface TaskContextType {
  // Data
  tasks: ParsedTask[];
  myTasks: ParsedTask[]; // tasks I created (community role)
  claimedTasks: ParsedTask[]; // tasks I accepted (taskor role)
  loading: boolean;
  error: string | null;
  contractConfigured: boolean;
  // T01: Task token balance
  taskTokenBalance: bigint | null;
  taskTokenBalanceFormatted: string | null;
  loadTaskTokenBalance: (address: string) => Promise<void>;
  // Actions
  loadAllTasks: () => Promise<void>;
  loadMyTasks: (address: string) => Promise<void>;
  createTask: (form: CreateTaskForm, send: SendFn) => Promise<`0x${string}` | null>;
  acceptTask: (taskId: string, send: SendFn) => Promise<boolean>;
  submitWork: (taskId: string, evidenceUri: string, send: SendFn) => Promise<boolean>;
  approveWork: (taskId: string, send: SendFn) => Promise<boolean>;
  finalizeTask: (taskId: string, send: SendFn) => Promise<boolean>;
  cancelTask: (taskId: string, send: SendFn) => Promise<boolean>;
  // T06: Receipts
  getTaskReceipts: (taskId: string) => Promise<`0x${string}`[]>;
  linkReceipt: (
    taskId: string,
    receiptId: string,
    receiptUri: string,
    send: SendFn
  ) => Promise<boolean>;
  // Helpers
  getTask: (taskId: string) => Promise<ParsedTask | null>;
  approveToken: (amount: bigint, send: SendFn) => Promise<boolean>;
  checkAllowance: (ownerAddress: string) => Promise<bigint>;
  // MT-11: challenge (escrow, ERC-20 stake) — approve + challengeWork two gasless ops
  juryConfigured: boolean;
  getChallengeStakeConfig: () => Promise<ChallengeStakeConfig | null>;
  checkStakeAllowance: (ownerAddress: string) => Promise<bigint>;
  approveStakeToken: (amount: bigint, send: SendFn) => Promise<boolean>;
  challengeWork: (taskId: string, send: SendFn) => Promise<boolean>;
  linkJuryValidation: (taskId: string, juryTaskHash: string, send: SendFn) => Promise<boolean>;
  // MT-11: validation requirements (read-only display)
  getValidationRequirements: (taskId: string) => Promise<ValidationRequirementView[]>;
  getValidationsSatisfied: (taskId: string) => Promise<boolean | null>;
  // MT-11: jury panel (JuryContract)
  getJuryStakingInfo: () => Promise<JuryStakingInfo | null>;
  getJurorStatus: (address: string) => Promise<{ isActive: boolean; stake: bigint }>;
  approveJuryStake: (amount: bigint, send: SendFn) => Promise<boolean>;
  registerJuror: (stakeAmount: bigint, send: SendFn) => Promise<boolean>;
  getJuryTask: (taskHash: string) => Promise<JuryTask | null>;
  getJuryVotes: (taskHash: string) => Promise<JuryVote[]>;
  voteOnJuryTask: (
    taskHash: string,
    response: number,
    reasoning: string,
    send: SendFn
  ) => Promise<boolean>;
  finalizeJuryTask: (taskHash: string, send: SendFn) => Promise<boolean>;
  getPendingJuryRewards: (address: string, token: `0x${string}`) => Promise<bigint>;
  claimJuryRewards: (token: `0x${string}`, send: SendFn) => Promise<boolean>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export function useTask(): TaskContextType {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTask must be used within TaskProvider");
  return ctx;
}

function parseTask(raw: Task): ParsedTask {
  const now = new Date();
  const deadline = new Date(Number(raw.deadline) * 1000);
  const challengeDeadline =
    raw.challengeDeadline > 0n ? new Date(Number(raw.challengeDeadline) * 1000) : null;

  const rewardFormatted = formatUnits(raw.reward, DEFAULT_REWARD_TOKEN_DECIMALS);
  const taskTypeLabel = TASK_TYPE_LABELS[raw.taskType] ?? raw.taskType.slice(0, 10);

  const canFinalize =
    raw.status === TaskStatus.Submitted && challengeDeadline !== null && now > challengeDeadline;
  const canChallenge =
    raw.status === TaskStatus.Submitted && challengeDeadline !== null && now <= challengeDeadline;

  return {
    taskId: raw.taskId,
    community: raw.community,
    taskor: raw.taskor,
    supplier: raw.supplier,
    token: raw.token,
    reward: raw.reward,
    rewardFormatted,
    supplierFee: raw.supplierFee,
    deadline,
    createdAt: new Date(Number(raw.createdAt) * 1000),
    challengeDeadline,
    challengeStake: raw.challengeStake,
    status: raw.status,
    statusLabel: TASK_STATUS_LABELS[raw.status] ?? "Unknown",
    metadataUri: raw.metadataUri,
    evidenceUri: raw.evidenceUri,
    taskType: raw.taskType,
    taskTypeLabel,
    juryTaskHash: raw.juryTaskHash,
    isExpired: now > deadline,
    canFinalize,
    canChallenge,
  };
}

/** Read an ERC-20's symbol/decimals, tolerating non-standard tokens. */
async function readTokenMeta(
  token: `0x${string}`,
  fallbackSymbol: string
): Promise<{ symbol: string; decimals: number }> {
  const client = getPublicClient();
  const [symbol, decimals] = await Promise.all([
    client
      .readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })
      .then(s => s as string)
      .catch(() => fallbackSymbol),
    client
      .readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" })
      .then(d => Number(d))
      .catch(() => 18),
  ]);
  return { symbol, decimals };
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [myTasks, setMyTasks] = useState<ParsedTask[]>([]);
  const [claimedTasks, setClaimedTasks] = useState<ParsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractConfigured = isContractsConfigured();
  // T01: task token balance
  const [taskTokenBalance, setTaskTokenBalance] = useState<bigint | null>(null);
  const [taskTokenBalanceFormatted, setTaskTokenBalanceFormatted] = useState<string | null>(null);

  const fetchTask = useCallback(
    async (client: PublicClient, taskId: `0x${string}`): Promise<ParsedTask | null> => {
      try {
        const raw = await client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "getTask",
          args: [taskId],
        });
        return parseTask(raw as Task);
      } catch {
        return null;
      }
    },
    []
  );

  const loadAllTasks = useCallback(async () => {
    if (!contractConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      // Fetch TaskCreated events from recent blocks
      const latestBlock = await client.getBlockNumber();
      const fromBlock = latestBlock > 200000n ? latestBlock - 200000n : 0n;
      const logs = await client.getLogs({
        address: TASK_ESCROW_ADDRESS,
        fromBlock,
        toBlock: "latest",
        topics: [keccak256(toBytes("TaskCreated(bytes32,address,address,uint256)"))],
      } as Parameters<typeof client.getLogs>[0]);

      // taskId is the first indexed param (topics[1]); deduplicate in case of reorgs
      const seen = new Set<string>();
      const taskIds = logs
        .map(l => l.topics[1] as `0x${string}` | undefined)
        .filter((id): id is `0x${string}` => !!id && !seen.has(id) && seen.add(id) !== undefined);
      const fetched = await Promise.all(taskIds.map(id => fetchTask(client, id)));
      const valid = fetched.filter((t): t is ParsedTask => t !== null);
      setTasks(valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, fetchTask]);

  const loadMyTasks = useCallback(
    async (address: string) => {
      if (!contractConfigured) return;
      setLoading(true);
      setError(null);
      try {
        const client = getPublicClient();
        const addr = address as `0x${string}`;

        const [communityIds, taskorIds] = await Promise.all([
          client.readContract({
            address: TASK_ESCROW_ADDRESS,
            abi: TASK_ESCROW_ABI,
            functionName: "getTasksByCommunity",
            args: [addr],
          }),
          client.readContract({
            address: TASK_ESCROW_ADDRESS,
            abi: TASK_ESCROW_ABI,
            functionName: "getTasksByTaskor",
            args: [addr],
          }),
        ]);

        const [mine, claimed] = await Promise.all([
          Promise.all((communityIds as `0x${string}`[]).map(id => fetchTask(client, id))),
          Promise.all((taskorIds as `0x${string}`[]).map(id => fetchTask(client, id))),
        ]);

        setMyTasks(mine.filter((t): t is ParsedTask => t !== null));
        setClaimedTasks(claimed.filter((t): t is ParsedTask => t !== null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load my tasks");
      } finally {
        setLoading(false);
      }
    },
    [contractConfigured, fetchTask]
  );

  const getTask = useCallback(
    async (taskId: string): Promise<ParsedTask | null> => {
      if (!contractConfigured) return null;
      const client = getPublicClient();
      return fetchTask(client, taskId as `0x${string}`);
    },
    [contractConfigured, fetchTask]
  );

  const checkAllowance = useCallback(async (ownerAddress: string): Promise<bigint> => {
    const client = getPublicClient();
    const allowance = await client.readContract({
      address: DEFAULT_REWARD_TOKEN,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [ownerAddress as `0x${string}`, TASK_ESCROW_ADDRESS],
    });
    return allowance as bigint;
  }, []);

  const approveToken = useCallback(async (amount: bigint, send: SendFn): Promise<boolean> => {
    await send({
      to: DEFAULT_REWARD_TOKEN,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [TASK_ESCROW_ADDRESS, amount],
    });
    return true;
  }, []);

  const createTask = useCallback(
    async (form: CreateTaskForm, send: SendFn): Promise<`0x${string}` | null> => {
      const reward = parseUnits(form.rewardAmount, DEFAULT_REWARD_TOKEN_DECIMALS);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + form.deadlineDays * 86400);

      // Build metadataUri as inline JSON (MVP: no IPFS)
      const metadata = JSON.stringify({
        title: form.title,
        description: form.description,
        createdAt: Math.floor(Date.now() / 1000),
      });

      // Let send() surface its own errors (revert reason / timeout) to the caller.
      const hash = await send({
        to: TASK_ESCROW_ADDRESS,
        abi: TASK_ESCROW_ABI,
        functionName: "createTask",
        args: [DEFAULT_REWARD_TOKEN, reward, deadline, metadata, form.taskType],
      });

      // send() resolves once mined; read the receipt to extract the taskId. Match
      // the emitting event by BOTH the escrow address AND the TaskCreated topic0 so
      // an unrelated same-address log can't be misread as the taskId.
      const client = getPublicClient();
      const receipt = await client.waitForTransactionReceipt({ hash });
      const log = receipt.logs.find(
        l =>
          l.address.toLowerCase() === TASK_ESCROW_ADDRESS.toLowerCase() &&
          l.topics[0] === TASK_CREATED_TOPIC
      );
      return (log?.topics[1] as `0x${string}` | undefined) ?? null;
    },
    []
  );

  const acceptTask = useCallback(async (taskId: string, send: SendFn): Promise<boolean> => {
    await send({
      to: TASK_ESCROW_ADDRESS,
      abi: TASK_ESCROW_ABI,
      functionName: "acceptTask",
      args: [taskId as `0x${string}`],
    });
    return true;
  }, []);

  const submitWork = useCallback(
    async (taskId: string, evidenceUri: string, send: SendFn): Promise<boolean> => {
      await send({
        to: TASK_ESCROW_ADDRESS,
        abi: TASK_ESCROW_ABI,
        functionName: "submitWork",
        args: [taskId as `0x${string}`, evidenceUri],
      });
      return true;
    },
    []
  );

  const approveWork = useCallback(async (taskId: string, send: SendFn): Promise<boolean> => {
    await send({
      to: TASK_ESCROW_ADDRESS,
      abi: TASK_ESCROW_ABI,
      functionName: "approveWork",
      args: [taskId as `0x${string}`],
    });
    return true;
  }, []);

  const finalizeTask = useCallback(async (taskId: string, send: SendFn): Promise<boolean> => {
    await send({
      to: TASK_ESCROW_ADDRESS,
      abi: TASK_ESCROW_ABI,
      functionName: "finalizeTask",
      args: [taskId as `0x${string}`],
    });
    return true;
  }, []);

  const cancelTask = useCallback(async (taskId: string, send: SendFn): Promise<boolean> => {
    await send({
      to: TASK_ESCROW_ADDRESS,
      abi: TASK_ESCROW_ABI,
      functionName: "cancelTask",
      args: [taskId as `0x${string}`],
    });
    return true;
  }, []);

  // T01: load task token balance for a given address
  const loadTaskTokenBalance = useCallback(async (address: string) => {
    if (!DEFAULT_REWARD_TOKEN || !address) return;
    try {
      const client = getPublicClient();
      const raw = await client.readContract({
        address: DEFAULT_REWARD_TOKEN,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      const balance = raw as bigint;
      setTaskTokenBalance(balance);
      setTaskTokenBalanceFormatted(formatUnits(balance, DEFAULT_REWARD_TOKEN_DECIMALS));
    } catch {
      // token not deployed or address invalid — silently ignore
    }
  }, []);

  // T06: get x402 receipts linked to a task
  const getTaskReceipts = useCallback(
    async (taskId: string): Promise<`0x${string}`[]> => {
      if (!contractConfigured) return [];
      try {
        const client = getPublicClient();
        const receipts = await client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "getTaskReceipts",
          args: [taskId as `0x${string}`],
        });
        return receipts as `0x${string}`[];
      } catch {
        return [];
      }
    },
    [contractConfigured]
  );

  // T06: link a receipt to a task
  const linkReceipt = useCallback(
    async (
      taskId: string,
      receiptId: string,
      receiptUri: string,
      send: SendFn
    ): Promise<boolean> => {
      // receiptId must be bytes32; if it's a plain string, hash it
      const receiptIdBytes =
        receiptId.startsWith("0x") && receiptId.length === 66
          ? (receiptId as `0x${string}`)
          : keccak256(toBytes(receiptId));
      await send({
        to: TASK_ESCROW_ADDRESS,
        abi: TASK_ESCROW_ABI,
        functionName: "linkReceipt",
        args: [taskId as `0x${string}`, receiptIdBytes, receiptUri],
      });
      return true;
    },
    []
  );

  // ====== MT-11: challenge (escrow side, ERC-20 stake) ======

  const juryConfigured = isJuryConfigured();

  /** Read the escrow's challenge-stake config (token = xPNT, amount = 10e18 by default). */
  const getChallengeStakeConfig = useCallback(async (): Promise<ChallengeStakeConfig | null> => {
    if (!contractConfigured) return null;
    try {
      const client = getPublicClient();
      const [token, amount] = await Promise.all([
        client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "challengeStakeToken",
        }) as Promise<`0x${string}`>,
        client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "challengeStakeAmount",
        }) as Promise<bigint>,
      ]);
      const meta = await readTokenMeta(token, "xPNT");
      return { token, amount, ...meta };
    } catch {
      return null;
    }
  }, [contractConfigured]);

  /** Allowance of the challenge-stake token (xPNT) granted to the escrow. */
  const checkStakeAllowance = useCallback(
    async (ownerAddress: string): Promise<bigint> => {
      const config = await getChallengeStakeConfig();
      if (!config) return 0n;
      const client = getPublicClient();
      const allowance = await client.readContract({
        address: config.token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [ownerAddress as `0x${string}`, TASK_ESCROW_ADDRESS],
      });
      return allowance as bigint;
    },
    [getChallengeStakeConfig]
  );

  /** Gasless op #1 of the challenge flow: approve the escrow to pull the stake. */
  const approveStakeToken = useCallback(
    async (amount: bigint, send: SendFn): Promise<boolean> => {
      const config = await getChallengeStakeConfig();
      if (!config) return false;
      await send({
        to: config.token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TASK_ESCROW_ADDRESS, amount],
      });
      return true;
    },
    [getChallengeStakeConfig]
  );

  /** Gasless op #2: challengeWork (community only, Submitted + inside challenge window). */
  const challengeWork = useCallback(async (taskId: string, send: SendFn): Promise<boolean> => {
    await send({
      to: TASK_ESCROW_ADDRESS,
      abi: TASK_ESCROW_ABI,
      functionName: "challengeWork",
      args: [taskId as `0x${string}`],
    });
    return true;
  }, []);

  /** Resolve a Challenged task against a COMPLETED jury task (anyone can call). */
  const linkJuryValidation = useCallback(
    async (taskId: string, juryTaskHash: string, send: SendFn): Promise<boolean> => {
      await send({
        to: TASK_ESCROW_ADDRESS,
        abi: TASK_ESCROW_ABI,
        functionName: "linkJuryValidation",
        args: [taskId as `0x${string}`, juryTaskHash as `0x${string}`],
      });
      return true;
    },
    []
  );

  // ====== MT-11: validation requirements (read-only display) ======

  const getValidationRequirements = useCallback(
    async (taskId: string): Promise<ValidationRequirementView[]> => {
      if (!contractConfigured) return [];
      try {
        const client = getPublicClient();
        const tags = (await client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "getTaskRequiredValidationTags",
          args: [taskId as `0x${string}`],
        })) as `0x${string}`[];
        const reqs = await Promise.all(
          tags.map(async tag => {
            const [minCount, minAvgResponse, minUniqueValidators, enabled] =
              (await client.readContract({
                address: TASK_ESCROW_ADDRESS,
                abi: TASK_ESCROW_ABI,
                functionName: "getTaskValidationRequirement",
                args: [taskId as `0x${string}`, tag],
              })) as [bigint, number, number, boolean];
            return { tag, minCount, minAvgResponse, minUniqueValidators, enabled };
          })
        );
        return reqs.filter(r => r.enabled);
      } catch {
        return [];
      }
    },
    [contractConfigured]
  );

  const getValidationsSatisfied = useCallback(
    async (taskId: string): Promise<boolean | null> => {
      if (!contractConfigured) return null;
      try {
        const client = getPublicClient();
        const ok = await client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "validationsSatisfied",
          args: [taskId as `0x${string}`],
        });
        return ok as boolean;
      } catch {
        return null;
      }
    },
    [contractConfigured]
  );

  // ====== MT-11: jury panel (JuryContract) ======

  /** Jury staking config: stakingToken (xPNT) + minStake (0 = role gates all off). */
  const getJuryStakingInfo = useCallback(async (): Promise<JuryStakingInfo | null> => {
    if (!juryConfigured) return null;
    try {
      const client = getPublicClient();
      const [token, minStake] = await Promise.all([
        client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "getStakingToken",
        }) as Promise<`0x${string}`>,
        client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "getMinJurorStake",
        }) as Promise<bigint>,
      ]);
      const meta = await readTokenMeta(token, "xPNT");
      return { token, minStake, ...meta };
    } catch {
      return null;
    }
  }, [juryConfigured]);

  const getJurorStatus = useCallback(
    async (address: string): Promise<{ isActive: boolean; stake: bigint }> => {
      if (!juryConfigured || !address) return { isActive: false, stake: 0n };
      try {
        const client = getPublicClient();
        const [isActive, stake] = (await client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "isActiveJuror",
          args: [address as `0x${string}`],
        })) as [boolean, bigint];
        return { isActive, stake };
      } catch {
        return { isActive: false, stake: 0n };
      }
    },
    [juryConfigured]
  );

  /** Gasless op #1 of registration: approve the jury contract to pull the stake.
   *  Even with minStake = 0 the flow keeps the approve+register two-op shape. */
  const approveJuryStake = useCallback(
    async (amount: bigint, send: SendFn): Promise<boolean> => {
      const info = await getJuryStakingInfo();
      if (!info) return false;
      await send({
        to: info.token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [JURY_CONTRACT_ADDRESS, amount],
      });
      return true;
    },
    [getJuryStakingInfo]
  );

  /** Gasless op #2: registerJuror(stakeAmount) — ERC-20 transferFrom stake. */
  const registerJuror = useCallback(async (stakeAmount: bigint, send: SendFn): Promise<boolean> => {
    await send({
      to: JURY_CONTRACT_ADDRESS,
      abi: JURY_CONTRACT_ABI,
      functionName: "registerJuror",
      args: [stakeAmount],
    });
    return true;
  }, []);

  const getJuryTask = useCallback(
    async (taskHash: string): Promise<JuryTask | null> => {
      if (!juryConfigured) return null;
      try {
        const client = getPublicClient();
        const raw = (await client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "getTask",
          args: [taskHash as `0x${string}`],
        })) as JuryTask;
        // Unknown hash returns an empty struct — treat as not found
        if (
          !raw.taskHash ||
          raw.taskHash === "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          return null;
        }
        return raw;
      } catch {
        return null;
      }
    },
    [juryConfigured]
  );

  const getJuryVotes = useCallback(
    async (taskHash: string): Promise<JuryVote[]> => {
      if (!juryConfigured) return [];
      try {
        const client = getPublicClient();
        const votes = await client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "getVotes",
          args: [taskHash as `0x${string}`],
        });
        return votes as JuryVote[];
      } catch {
        return [];
      }
    },
    [juryConfigured]
  );

  /** Juror vote: response is a 0-100 score; reasoning is a free-text/URI note. */
  const voteOnJuryTask = useCallback(
    async (
      taskHash: string,
      response: number,
      reasoning: string,
      send: SendFn
    ): Promise<boolean> => {
      await send({
        to: JURY_CONTRACT_ADDRESS,
        abi: JURY_CONTRACT_ABI,
        functionName: "vote",
        args: [taskHash as `0x${string}`, response, reasoning],
      });
      return true;
    },
    []
  );

  const finalizeJuryTask = useCallback(async (taskHash: string, send: SendFn): Promise<boolean> => {
    await send({
      to: JURY_CONTRACT_ADDRESS,
      abi: JURY_CONTRACT_ABI,
      functionName: "finalizeTask",
      args: [taskHash as `0x${string}`],
    });
    return true;
  }, []);

  /** Pull-mode reward pool: claimable balance for (juror, token). */
  const getPendingJuryRewards = useCallback(
    async (address: string, token: `0x${string}`): Promise<bigint> => {
      if (!juryConfigured || !address || !token) return 0n;
      try {
        const client = getPublicClient();
        const amount = await client.readContract({
          address: JURY_CONTRACT_ADDRESS,
          abi: JURY_CONTRACT_ABI,
          functionName: "pendingRewards",
          args: [address as `0x${string}`, token],
        });
        return amount as bigint;
      } catch {
        return 0n;
      }
    },
    [juryConfigured]
  );

  const claimJuryRewards = useCallback(
    async (token: `0x${string}`, send: SendFn): Promise<boolean> => {
      await send({
        to: JURY_CONTRACT_ADDRESS,
        abi: JURY_CONTRACT_ABI,
        functionName: "claimRewards",
        args: [token],
      });
      return true;
    },
    []
  );

  // Auto-load tasks when context mounts
  useEffect(() => {
    if (contractConfigured) {
      loadAllTasks();
    }
  }, [contractConfigured, loadAllTasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        myTasks,
        claimedTasks,
        loading,
        error,
        contractConfigured,
        // T01
        taskTokenBalance,
        taskTokenBalanceFormatted,
        loadTaskTokenBalance,
        loadAllTasks,
        loadMyTasks,
        createTask,
        acceptTask,
        submitWork,
        approveWork,
        finalizeTask,
        cancelTask,
        // T06
        getTaskReceipts,
        linkReceipt,
        getTask,
        approveToken,
        checkAllowance,
        // MT-11: challenge / arbitration
        juryConfigured,
        getChallengeStakeConfig,
        checkStakeAllowance,
        approveStakeToken,
        challengeWork,
        linkJuryValidation,
        getValidationRequirements,
        getValidationsSatisfied,
        getJuryStakingInfo,
        getJurorStatus,
        approveJuryStake,
        registerJuror,
        getJuryTask,
        getJuryVotes,
        voteOnJuryTask,
        finalizeJuryTask,
        getPendingJuryRewards,
        claimJuryRewards,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}
