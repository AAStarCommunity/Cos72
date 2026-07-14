"use client";

/**
 * MT-11: Jury panel — juror registration (ERC-20 stake), voting on jury tasks
 * (0-100 score), finalization, and the pull-mode reward pool
 * (pendingRewards / claimRewards).
 *
 * All writes are gasless sponsored UserOps via `useCos72Session().send`
 * (AirAccount-only, zero window.ethereum). Registration is always the two-op
 * approve + registerJuror flow, mirroring the reward-escrow approve + create
 * pattern — even when minStake = 0.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { formatUnits, parseUnits } from "viem";
import Layout from "@/components/Layout";
import { useTask } from "@/contexts/TaskContext";
import { useCos72Session } from "@/contexts/Cos72SessionContext";
import { getStoredAuth } from "@/lib/auth";
import {
  type JuryTask,
  type JuryVote,
  type JuryStakingInfo,
  JuryTaskStatus,
} from "@/lib/task-types";
import {
  DEFAULT_REWARD_TOKEN,
  DEFAULT_REWARD_TOKEN_SYMBOL,
  DEFAULT_REWARD_TOKEN_DECIMALS,
} from "@/lib/contracts/task-config";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ScaleIcon,
  CheckCircleIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { formatDateTime } from "@/lib/date-utils";
import toast from "react-hot-toast";

const isBytes32 = (v: string) => /^0x[0-9a-fA-F]{64}$/.test(v);

const JURY_STATUS_COLORS: Record<JuryTaskStatus, string> = {
  [JuryTaskStatus.Pending]: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  [JuryTaskStatus.InProgress]:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  [JuryTaskStatus.Completed]:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  [JuryTaskStatus.Disputed]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  [JuryTaskStatus.Cancelled]: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function JuryPanelPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    juryConfigured,
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
  } = useTask();
  const { send, address: sessionAddress, isConnected } = useCos72Session();

  // Juror status / staking config
  const [stakingInfo, setStakingInfo] = useState<JuryStakingInfo | null>(null);
  const [jurorActive, setJurorActive] = useState(false);
  const [jurorStake, setJurorStake] = useState<bigint>(0n);
  const [stakeInput, setStakeInput] = useState("");
  // Jury task lookup + voting
  const [hashInput, setHashInput] = useState("");
  const [juryTask, setJuryTask] = useState<JuryTask | null>(null);
  const [juryVotes, setJuryVotes] = useState<JuryVote[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [reasoningInput, setReasoningInput] = useState("");
  // Rewards (pull pattern): reward token + staking token when distinct
  const [pendingReward, setPendingReward] = useState<bigint>(0n);
  const [pendingStakeToken, setPendingStakeToken] = useState<bigint>(0n);
  const [actionLoading, setActionLoading] = useState(false);

  const myAddress = (sessionAddress ?? "").toLowerCase();

  useEffect(() => {
    const { token } = getStoredAuth();
    if (!token) router.push("/auth/login");
  }, [router]);

  const refreshJurorState = useCallback(async () => {
    if (!juryConfigured) return;
    const info = await getJuryStakingInfo();
    setStakingInfo(info);
    if (sessionAddress) {
      const status = await getJurorStatus(sessionAddress);
      setJurorActive(status.isActive);
      setJurorStake(status.stake);
      if (DEFAULT_REWARD_TOKEN) {
        setPendingReward(await getPendingJuryRewards(sessionAddress, DEFAULT_REWARD_TOKEN));
      }
      if (info && info.token.toLowerCase() !== DEFAULT_REWARD_TOKEN.toLowerCase()) {
        setPendingStakeToken(await getPendingJuryRewards(sessionAddress, info.token));
      }
    }
  }, [juryConfigured, sessionAddress, getJuryStakingInfo, getJurorStatus, getPendingJuryRewards]);

  useEffect(() => {
    refreshJurorState();
  }, [refreshJurorState]);

  const refreshJuryTask = useCallback(
    async (hash: string) => {
      setTaskLoading(true);
      try {
        const [task, votes] = await Promise.all([getJuryTask(hash), getJuryVotes(hash)]);
        setJuryTask(task);
        setJuryVotes(votes);
        if (!task) toast.error(t("juryPage.notFound"));
      } finally {
        setTaskLoading(false);
      }
    },
    [getJuryTask, getJuryVotes, t]
  );

  async function handleLoadTask() {
    const hash = hashInput.trim();
    if (!isBytes32(hash)) {
      toast.error(t("juryPage.invalidHash"));
      return;
    }
    await refreshJuryTask(hash);
  }

  // Always the two-op approve + registerJuror flow (even with minStake = 0)
  async function handleRegister() {
    if (!isConnected) {
      toast.error(t("juryPage.loginRequired"));
      return;
    }
    if (!stakingInfo) return;
    const raw = stakeInput.trim() || "0";
    let amount: bigint;
    try {
      amount = parseUnits(raw, stakingInfo.decimals);
    } catch {
      toast.error(t("juryPage.invalidAmount"));
      return;
    }
    if (amount < 0n) {
      toast.error(t("juryPage.invalidAmount"));
      return;
    }
    if (amount < stakingInfo.minStake) {
      toast.error(t("juryPage.stakeTooLow"));
      return;
    }
    setActionLoading(true);
    try {
      toast.loading(t("juryPage.approvingStake"), { id: "jury-approve" });
      await approveJuryStake(amount, send);
      toast.dismiss("jury-approve");
      toast.loading(t("juryPage.registering"), { id: "jury-register" });
      await registerJuror(amount, send);
      toast.dismiss("jury-register");
      toast.success(t("juryPage.registered"));
      await refreshJurorState();
    } catch (err) {
      toast.dismiss("jury-approve");
      toast.dismiss("jury-register");
      toast.error(err instanceof Error && err.message ? err.message : t("juryPage.genericError"));
    } finally {
      setActionLoading(false);
    }
  }

  async function runJuryAction(fn: () => Promise<boolean>, pendingMsg: string, successMsg: string) {
    if (!isConnected) {
      toast.error(t("juryPage.loginRequired"));
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading(pendingMsg);
    try {
      await fn();
      toast.dismiss(toastId);
      toast.success(successMsg);
      if (juryTask) await refreshJuryTask(juryTask.taskHash);
      await refreshJurorState();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error && err.message ? err.message : t("juryPage.genericError"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVote() {
    if (!juryTask) return;
    const score = Number(scoreInput);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      toast.error(t("juryPage.invalidAmount"));
      return;
    }
    await runJuryAction(
      () => voteOnJuryTask(juryTask.taskHash, score, reasoningInput.trim(), send),
      t("juryPage.voting"),
      t("juryPage.voted")
    );
    setScoreInput("");
    setReasoningInput("");
  }

  const alreadyVoted = juryVotes.some(v => v.juror.toLowerCase() === myAddress);
  const now = Math.floor(Date.now() / 1000);
  const taskInProgress = juryTask?.status === JuryTaskStatus.InProgress;
  const votingOpen = taskInProgress && juryTask !== null && now <= Number(juryTask.deadline);
  const canFinalizeJury =
    taskInProgress &&
    juryTask !== null &&
    (now > Number(juryTask.deadline) || juryTask.totalVotes >= juryTask.minJurors);

  const rewardRows: { token: `0x${string}`; symbol: string; decimals: number; amount: bigint }[] =
    [];
  if (DEFAULT_REWARD_TOKEN) {
    rewardRows.push({
      token: DEFAULT_REWARD_TOKEN,
      symbol: DEFAULT_REWARD_TOKEN_SYMBOL,
      decimals: DEFAULT_REWARD_TOKEN_DECIMALS,
      amount: pendingReward,
    });
  }
  if (stakingInfo && stakingInfo.token.toLowerCase() !== DEFAULT_REWARD_TOKEN.toLowerCase()) {
    rewardRows.push({
      token: stakingInfo.token,
      symbol: stakingInfo.symbol,
      decimals: stakingInfo.decimals,
      amount: pendingStakeToken,
    });
  }

  return (
    <Layout requireAuth>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/tasks")}
            title={t("juryPage.back")}
            className="mt-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <ScaleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("juryPage.title")}
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t("juryPage.subtitle")}
            </p>
          </div>
          <button
            onClick={refreshJurorState}
            title={t("juryPage.refresh")}
            className="mt-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>

        {!juryConfigured ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("juryPage.notConfigured")}</p>
        ) : (
          <>
            {/* Juror status + registration */}
            <Section title={t("juryPage.statusTitle")}>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("juryPage.taskStatus")}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      jurorActive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {jurorActive ? t("juryPage.active") : t("juryPage.inactive")}
                  </span>
                </div>
                {stakingInfo && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("juryPage.minStake")}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {formatUnits(stakingInfo.minStake, stakingInfo.decimals)}{" "}
                        {stakingInfo.symbol}
                      </span>
                    </div>
                    {jurorActive && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("juryPage.yourStake")}
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {formatUnits(jurorStake, stakingInfo.decimals)} {stakingInfo.symbol}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {!jurorActive && stakingInfo && (
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">
                      {t("juryPage.stakeAmountLabel", { symbol: stakingInfo.symbol })}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={stakeInput}
                      onChange={e => setStakeInput(e.target.value)}
                      placeholder={formatUnits(stakingInfo.minStake, stakingInfo.decimals)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleRegister}
                      disabled={actionLoading}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                    >
                      {actionLoading ? t("juryPage.registering") : t("juryPage.register")}
                    </button>
                  </div>
                )}
              </div>
            </Section>

            {/* Vote on a jury task */}
            <Section title={t("juryPage.voteTitle")}>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={hashInput}
                    onChange={e => setHashInput(e.target.value)}
                    placeholder={t("juryPage.taskHashPlaceholder")}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleLoadTask}
                    disabled={taskLoading || !isBytes32(hashInput.trim())}
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-sm font-medium transition-colors shrink-0"
                  >
                    {taskLoading ? t("juryPage.loadingTask") : t("juryPage.load")}
                  </button>
                </div>

                {juryTask && (
                  <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("juryPage.taskStatus")}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          JURY_STATUS_COLORS[juryTask.status] ?? JURY_STATUS_COLORS[0]
                        }`}
                      >
                        {t(`juryPage.status${juryTask.status}`)}
                      </span>
                    </div>
                    {juryTask.evidenceUri && (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("juryPage.evidence")}:{" "}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 break-words">
                          {juryTask.evidenceUri}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("juryPage.votingDeadline")}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDateTime(new Date(Number(juryTask.deadline) * 1000))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("juryPage.votes")}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {juryTask.totalVotes.toString()} / {juryTask.minJurors.toString()} (
                        {t("juryPage.consensus")}{" "}
                        {(Number(juryTask.consensusThreshold) / 100).toFixed(0)}
                        %)
                      </span>
                    </div>
                    {juryTask.status === JuryTaskStatus.Completed ||
                    juryTask.status === JuryTaskStatus.Disputed ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("juryPage.finalScore")}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {juryTask.finalResponse} / 100
                        </span>
                      </div>
                    ) : null}

                    {/* Cast votes */}
                    {juryVotes.length > 0 && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("juryPage.votesList")}
                        </p>
                        {juryVotes.map((v, i) => (
                          <div
                            key={`${v.juror}-${i}`}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="font-mono text-gray-600 dark:text-gray-300">
                              {v.juror.slice(0, 8)}…{v.juror.slice(-6)}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {t("juryPage.score")} {v.response}
                              {v.slashed && (
                                <span className="ml-1 text-red-500">({t("juryPage.slashed")})</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vote form */}
                    {votingOpen && jurorActive && !alreadyVoted && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          {t("juryPage.scoreLabel")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={scoreInput}
                          onChange={e => setScoreInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          {t("juryPage.reasoningLabel")}
                        </label>
                        <textarea
                          value={reasoningInput}
                          onChange={e => setReasoningInput(e.target.value)}
                          placeholder={t("juryPage.reasoningPlaceholder")}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />
                        <button
                          onClick={handleVote}
                          disabled={actionLoading || scoreInput === ""}
                          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                        >
                          {actionLoading ? t("juryPage.voting") : t("juryPage.voteButton")}
                        </button>
                      </div>
                    )}
                    {taskInProgress && !jurorActive && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t("juryPage.notJuror")}
                      </p>
                    )}
                    {taskInProgress && jurorActive && alreadyVoted && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t("juryPage.alreadyVoted")}
                      </p>
                    )}
                    {!taskInProgress &&
                      juryTask.status !== JuryTaskStatus.Completed &&
                      juryTask.status !== JuryTaskStatus.Disputed && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("juryPage.voteNotOpen")}
                        </p>
                      )}

                    {/* Finalize */}
                    {canFinalizeJury && (
                      <button
                        onClick={() =>
                          runJuryAction(
                            () => finalizeJuryTask(juryTask.taskHash, send),
                            t("juryPage.finalizing"),
                            t("juryPage.finalized")
                          )
                        }
                        disabled={actionLoading}
                        className="w-full py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        {actionLoading ? t("juryPage.finalizing") : t("juryPage.finalizeButton")}
                      </button>
                    )}
                    {taskInProgress && !canFinalizeJury && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t("juryPage.finalizeHint")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Section>

            {/* Rewards (pull pattern) */}
            <Section title={t("juryPage.rewardsTitle")}>
              {rewardRows.length === 0 || rewardRows.every(r => r.amount === 0n) ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("juryPage.nothingToClaim")}
                </p>
              ) : (
                <div className="space-y-3">
                  {rewardRows
                    .filter(r => r.amount > 0n)
                    .map(r => (
                      <div key={r.token} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <BanknotesIcon className="w-4 h-4 text-emerald-500" />
                          <span className="text-gray-500 dark:text-gray-400">
                            {t("juryPage.pendingLabel")}
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatUnits(r.amount, r.decimals)} {r.symbol}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            runJuryAction(
                              () => claimJuryRewards(r.token, send),
                              t("juryPage.claiming"),
                              t("juryPage.claimed")
                            )
                          }
                          disabled={actionLoading}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium transition-colors shrink-0"
                        >
                          {actionLoading ? t("juryPage.claiming") : t("juryPage.claim")}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </Layout>
  );
}
