/**
 * Phase 0 verification page (§DoD) — rendered inside YAA's real app shell
 * (`<Layout>` + design system), exercising the shared layer end-to-end:
 * 0.1 session, 0.3 canonical infra addresses, 0.4 role-gated nav, 0.5 credibility.
 * No module business logic; the write path (cosSend) needs the backend `/userop/*`.
 */
"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import type { Address } from "viem";
import Layout from "@/components/Layout";
import { Cos72SessionProvider, useCos72Session } from "@/contexts/Cos72SessionContext";
import { CommunityNav } from "@/components/nav/CommunityNav";
import { infraAddresses } from "@/lib/addresses";
import { listCommunityTokens, readCredibility, type Credibility } from "@/lib/community";

const CARD =
  "bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5";
const H2 = "text-sm font-semibold text-gray-900 dark:text-white mb-3";

function SessionPanel() {
  const { address, isConnected, isLoading } = useCos72Session();
  return (
    <section className={CARD}>
      <h2 className={H2}>0.1 统一会话（AirAccount-only）</h2>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">加载中…</p>
      ) : isConnected ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          已登录 · AirAccount 地址：
          <code className="font-mono break-all text-emerald-600 dark:text-emerald-400">
            {address ?? "（无账户，去建号）"}
          </code>
        </p>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          未登录（passkey 登录后显示 AirAccount 地址）
        </p>
      )}
    </section>
  );
}

function NavPanel() {
  return (
    <section className={CARD}>
      <h2 className={H2}>0.4 社区导航（L2，仿 GitHub，按链上角色显隐）</h2>
      <CommunityNav active="overview" />
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        治理 / 发币仅社区 owner 可见；运维·Operator（EOA 轨道）仅持 operator 角色可见。
      </p>
    </section>
  );
}

function AddressPanel() {
  let addrs: Record<string, Address> | null = null;
  let err: string | null = null;
  try {
    addrs = infraAddresses() as unknown as Record<string, Address>;
  } catch (e) {
    err = String(e);
  }
  return (
    <section className={CARD}>
      <h2 className={H2}>0.3 canonical 地址（来自 @aastar/sdk）</h2>
      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400">地址解析失败：{err}</p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Object.entries(addrs!).map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">{k}: </span>
              <code className="font-mono break-all text-gray-700 dark:text-gray-300">{v}</code>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CredibilityPanel() {
  const [rows, setRows] = useState<{ token: Address; cred: Credibility }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const factory = infraAddresses().xPNTsFactory;
      const tokens = await listCommunityTokens(factory);
      const out: { token: Address; cred: Credibility }[] = [];
      for (const token of tokens) out.push({ token, cred: await readCredibility(token) });
      setRows(out);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={CARD}>
      <h2 className={H2}>0.5 社区 xPNTs 可信度</h2>
      <button
        onClick={load}
        disabled={loading}
        className="mb-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "读取中…" : "读取社区 xPNTs 可信度"}
      </button>
      {err && (
        <p className="text-sm text-red-600 dark:text-red-400">读取失败（需已配置 RPC）：{err}</p>
      )}
      {rows.map(({ token, cred }) => (
        <div
          key={token}
          className="mt-2 border-t border-gray-100 pt-2 text-xs dark:border-gray-700"
        >
          <code className="font-mono break-all text-gray-700 dark:text-gray-300">{token}</code>
          <div className="mt-1 text-gray-700 dark:text-gray-300">
            可信度：<b>{cred.credibilityScore}</b>/100
            {cred.isOverIssued && (
              <span className="ml-2 text-red-600 dark:text-red-400">⚠ 已超发</span>
            )}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            发行 ${formatUnits(cred.issuedValueUSD, 18)} · 背书 $
            {formatUnits(cred.backingValueUSD, 18)} · 上限 ${formatUnits(cred.effectiveCapUSD, 18)}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Phase0Page() {
  return (
    <Layout>
      <Cos72SessionProvider>
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Cos72 Phase 0 — 共享集成层
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              会话 / canonical 地址 / 角色导航 / 社区可信度。写路径（cosSend）待后端 /userop 部署。
            </p>
          </div>
          <NavPanel />
          <SessionPanel />
          <AddressPanel />
          <CredibilityPanel />
        </div>
      </Cos72SessionProvider>
    </Layout>
  );
}
