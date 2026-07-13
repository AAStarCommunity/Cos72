"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseUnits } from "viem";
import Layout from "@/components/Layout";
import { useTask } from "@/contexts/TaskContext";
import { useCos72Session } from "@/contexts/Cos72SessionContext";
import { getStoredAuth } from "@/lib/auth";
import {
  ALL_TASK_TYPES,
  DEFAULT_REWARD_TOKEN_SYMBOL,
  DEFAULT_REWARD_TOKEN_DECIMALS,
  TASK_TYPE_GENERAL,
} from "@/lib/contracts/task-config";
import { type CreateTaskForm } from "@/lib/task-types";
import { ArrowLeftIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

const DEADLINE_OPTIONS = [
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

export default function CreateTaskPage() {
  const router = useRouter();
  const { createTask, approveToken, checkAllowance, contractConfigured } = useTask();
  // Cos72 is AirAccount-only: every write is a gasless sponsored UserOp via the
  // session's `send`. No window.ethereum, no EOA, no EIP-2612 permit (an AA
  // cannot EOA-sign typed data). Reward escrow = approve(send) + createTask(send).
  const { send, isConnected, address } = useCos72Session();

  const [form, setForm] = useState<CreateTaskForm>({
    title: "",
    description: "",
    rewardAmount: "",
    deadlineDays: 7,
    taskType: TASK_TYPE_GENERAL,
  });
  const [step, setStep] = useState<"form" | "approve" | "submit">("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { token } = getStoredAuth();
    if (!token) {
      router.push("/auth/login");
    }
  }, [router]);

  const handleUpdate = <K extends keyof CreateTaskForm>(key: K, value: CreateTaskForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const isValid =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    parseFloat(form.rewardAmount) > 0;

  async function handleSubmit() {
    if (!isValid) return;
    if (!isConnected || !address) {
      toast.error("Passkey login required to post a task.");
      return;
    }
    if (!contractConfigured) {
      toast.error("Contract not configured. Check NEXT_PUBLIC_TASK_ESCROW_ADDRESS.");
      return;
    }

    setSubmitting(true);
    try {
      const rewardWei = parseUnits(form.rewardAmount, DEFAULT_REWARD_TOKEN_DECIMALS);

      // ── Step 1: ensure the escrow can pull the reward (skip once xPNTs auto-
      // approves the escrow spender; mock USDC needs an explicit approve). ──
      const currentAllowance = await checkAllowance(address);
      if (currentAllowance < rewardWei) {
        setStep("approve");
        toast.loading("Approving reward token (gasless)...", { id: "approve" });
        const approved = await approveToken(rewardWei, send);
        toast.dismiss("approve");
        if (!approved) {
          toast.error("Token approval failed");
          setStep("form");
          return;
        }
        toast.success("Token approved");
      }

      // ── Step 2: create the task on-chain (gasless sponsored UserOp). ──
      setStep("submit");
      toast.loading("Creating task on-chain (gasless)...", { id: "create" });
      const taskId = await createTask(form, send);
      toast.dismiss("create");

      if (taskId) {
        toast.success("Task created successfully!");
        router.push(`/tasks/${taskId}`);
      } else {
        toast.error("Failed to create task");
        setStep("form");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout requireAuth>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Post a Task</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Describe what you need done and set a reward
            </p>
          </div>
        </div>

        {/* Not-logged-in warning */}
        {!isConnected && (
          <div className="mb-5 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-400 flex gap-2">
            <InformationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Sign in with your passkey to post a task. Rewards are escrowed gaslessly from your
              AirAccount — no wallet extension, no ETH for gas.
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => handleUpdate("title", e.target.value)}
              placeholder="e.g. Design a landing page for our community"
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => handleUpdate("description", e.target.value)}
              placeholder="Describe what needs to be done, any requirements or constraints..."
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TASK_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleUpdate("taskType", t.value)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    form.taskType === t.value
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reward */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Reward ({DEFAULT_REWARD_TOKEN_SYMBOL}) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={form.rewardAmount}
                onChange={e => handleUpdate("rewardAmount", e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 pr-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                {DEFAULT_REWARD_TOKEN_SYMBOL}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Distribution: 70% to taskor, 20% to supplier (if any), 10% to jury
            </p>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Deadline
            </label>
            <div className="flex gap-2">
              {DEADLINE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleUpdate("deadlineDays", opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    form.deadlineDays === opt.value
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {isValid && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm space-y-1.5">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Summary</p>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Reward locked in escrow</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {form.rewardAmount} {DEFAULT_REWARD_TOKEN_SYMBOL}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Deadline</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {form.deadlineDays} days from now
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Challenge period after submission</span>
                <span className="font-medium text-gray-900 dark:text-white">3 days</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting || !isConnected}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 font-medium text-sm transition-colors"
          >
            {submitting
              ? step === "approve"
                ? "Approving token..."
                : "Creating task..."
              : !isConnected
                ? "Sign in to post"
                : "Post Task (gasless)"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
