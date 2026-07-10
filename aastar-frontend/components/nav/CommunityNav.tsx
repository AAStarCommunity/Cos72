/**
 * L2 community navigation (Phase 0 §0.4) — the GitHub-org-style horizontal tabs
 * shown once you're inside a community. The tabs are the modules, common to all
 * communities, gated by the account's on-chain role:
 *
 *   L1 用户菜单（跨社区）= 沿用 YAAA 右上用户菜单（不在此）
 *   L2 社区菜单（本组件）= 概览 / MyTask / MyShop / MyVote / 成员 / 治理·发币(owner)
 *   L3 模块子导航        = 各模块自己的 sub-nav（进入模块后，本 PR 不含）
 *
 * EOA 分层：infra/operator（部署 / DVT-register，EOA 轨道）不是社区 tab —— 单独一个
 * 「运维」入口（链到现有 app/operator/*），仅在账户持 operator 角色时出现。
 *
 * @module components/nav/CommunityNav
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCos72Session } from "@/contexts/Cos72SessionContext";
import { EMPTY_ROLES, readRoles, type RoleFlags } from "@/lib/roles";

type Tab = {
  key: string;
  label: string;
  href: string;
  /** Only shown when the account is a community owner. */
  ownerOnly?: boolean;
  /** Module not built yet — render disabled. */
  soon?: boolean;
};

const TABS: Tab[] = [
  { key: "overview", label: "概览", href: "#" },
  { key: "mytask", label: "MyTask", href: "#", soon: true },
  { key: "myshop", label: "MyShop", href: "#", soon: true },
  { key: "myvote", label: "MyVote", href: "#", soon: true },
  { key: "members", label: "成员", href: "#" },
  { key: "governance", label: "治理", href: "#", ownerOnly: true },
  { key: "issue", label: "发币", href: "#", ownerOnly: true },
];

/** Load the connected account's roles (empty until logged in / loaded). */
function useRoles(): { roles: RoleFlags; loading: boolean } {
  const { address } = useCos72Session();
  const [roles, setRoles] = useState<RoleFlags>(EMPTY_ROLES);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setRoles(EMPTY_ROLES);
      return;
    }
    setLoading(true);
    readRoles(address)
      .then((r) => !cancelled && setRoles(r))
      .catch(() => !cancelled && setRoles(EMPTY_ROLES))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address]);
  return { roles, loading };
}

export function CommunityNav({ active }: { active?: string }) {
  const { roles, loading } = useRoles();
  const tabs = TABS.filter((t) => !t.ownerOnly || roles.community);

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700">
      <ul className="flex flex-wrap items-center gap-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          const base = "px-3 py-2 text-sm rounded-t transition-colors";
          if (t.soon) {
            return (
              <li key={t.key}>
                <span
                  className={`${base} cursor-not-allowed text-gray-400 dark:text-gray-500`}
                  title="即将上线"
                >
                  {t.label}
                </span>
              </li>
            );
          }
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                className={`${base} ${
                  isActive
                    ? "border-b-2 border-emerald-500 font-medium text-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
        {/* infra/operator = EOA 轨道，独立入口，非社区 tab */}
        {roles.operator && (
          <li className="ml-auto">
            <Link
              href="/operator"
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              运维 · Operator（EOA）
            </Link>
          </li>
        )}
      </ul>
      {loading && (
        <p className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">读取角色中…</p>
      )}
    </nav>
  );
}
