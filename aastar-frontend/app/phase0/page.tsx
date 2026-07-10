/**
 * Phase 0 verification page (§DoD).
 *
 * Exercises the shared layer end-to-end, client-side, with no module business
 * logic: 0.1 session (AirAccount address), 0.3 canonical infra addresses, 0.5
 * community xPNTs credibility read. The gasless write path (cosSend) needs the
 * backend `/userop/*` endpoints (next stage) so it's not exercised here.
 */
"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import type { Address } from "viem";
import { Cos72SessionProvider, useCos72Session } from "@/contexts/Cos72SessionContext";
import { infraAddresses } from "@/lib/addresses";
import { listCommunityTokens, readCredibility, type Credibility } from "@/lib/community";

function SessionPanel() {
  const { address, isConnected, isLoading } = useCos72Session();
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-2 font-semibold">0.1 统一会话（AirAccount-only）</h2>
      {isLoading ? (
        <p className="text-sm text-gray-500">加载中…</p>
      ) : isConnected ? (
        <p className="text-sm">
          已登录 · AirAccount 地址：<code className="break-all">{address ?? "（无账户，去建号）"}</code>
        </p>
      ) : (
        <p className="text-sm text-gray-500">未登录（passkey 登录后显示 AirAccount 地址）</p>
      )}
    </section>
  );
}

function AddressPanel() {
  let addrs: Record<string, Address>;
  try {
    addrs = infraAddresses() as unknown as Record<string, Address>;
  } catch (e) {
    return <p className="text-sm text-red-600">地址解析失败：{String(e)}</p>;
  }
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-2 font-semibold">0.3 canonical 地址（来自 @aastar/sdk）</h2>
      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {Object.entries(addrs).map(([k, v]) => (
          <div key={k}>
            <span className="text-gray-500">{k}: </span>
            <code className="break-all">{v}</code>
          </div>
        ))}
      </div>
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
    <section className="rounded-lg border p-4">
      <h2 className="mb-2 font-semibold">0.5 社区 xPNTs 可信度</h2>
      <button
        onClick={load}
        disabled={loading}
        className="mb-3 rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {loading ? "读取中…" : "读取社区 xPNTs 可信度"}
      </button>
      {err && <p className="text-sm text-red-600">读取失败（需已配置 RPC）：{err}</p>}
      {rows.map(({ token, cred }) => (
        <div key={token} className="mb-2 border-t pt-2 text-xs">
          <div>
            <code className="break-all">{token}</code>
          </div>
          <div>
            可信度：<b>{cred.credibilityScore}</b>/100
            {cred.isOverIssued && <span className="ml-2 text-red-600">⚠ 已超发</span>}
          </div>
          <div className="text-gray-500">
            发行 ${formatUnits(cred.issuedValueUSD, 18)} · 背书 ${formatUnits(cred.backingValueUSD, 18)}{" "}
            · 上限 ${formatUnits(cred.effectiveCapUSD, 18)}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Phase0Page() {
  return (
    <Cos72SessionProvider>
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-bold">Cos72 Phase 0 — 共享层验证</h1>
        <p className="text-sm text-gray-500">
          验证会话 / canonical 地址 / 社区可信度。写路径（cosSend）待后端 /userop 上线。
        </p>
        <SessionPanel />
        <AddressPanel />
        <CredibilityPanel />
      </main>
    </Cos72SessionProvider>
  );
}
