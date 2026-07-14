/**
 * cos72 SSO authorize kickoff (MV-7, cos72 half of the MyVote SSO handoff).
 *
 * This page is a *transition*, not a destination — there is nothing to click on the happy
 * path. MyVote sends the browser here with `?redirect_uri=https://<myvote>/sso/callback`, and:
 *
 *   1. no cos72 session   → bounce to /auth/login?redirect=<this page, params preserved>,
 *                           so the handoff resumes automatically after sign-in;
 *   2. session present    → POST /sso/authorize { redirect_uri } with the cos72 JWT (MV-1);
 *   3. 200                → location.replace(`${redirectUri}?code=${code}`) — MyVote then
 *                           swaps the one-time code for an SSO token via POST /sso/exchange;
 *   4. 400 / 401 /网络    → an explicit error card (never a silent dead end), with copy an
 *                           operator can act on (the whitelist case names SSO_ALLOWED_REDIRECTS).
 *
 * OPEN-REDIRECT NOTE: the code is appended to `redirectUri` **as echoed back by the backend**,
 * never to the raw `?redirect_uri` query value. The backend validates it fail-closed against
 * SSO_ALLOWED_REDIRECTS and returns its normalized form, so an attacker-supplied redirect_uri
 * can only ever produce a 400 here — this page performs no whitelist logic of its own (a
 * frontend check would be both bypassable and a second source of truth).
 *
 * @module app/sso/start/page
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Layout from "@/components/Layout";
import { ssoAPI } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

/** Distinguishable failure modes — each maps to its own i18n message. */
type ErrorKind =
  | "missingRedirect" // no ?redirect_uri in the URL
  | "notWhitelisted" // 400: redirect_uri not in SSO_ALLOWED_REDIRECTS (ops-actionable)
  | "noAccount" // 400: the cos72 user has no AirAccount yet
  | "unauthorized" // 401: cos72 session missing/expired/rejected
  | "badRedirect" // 200 but the echoed redirectUri doesn't parse (should never happen)
  | "network" // request never got a response
  | "unknown"; // any other backend error

type Phase = { status: "working" } | { status: "error"; kind: ErrorKind; detail?: string };

/** The backend's whitelist rejection — matched on the env var name it names in its message. */
const WHITELIST_HINT = /SSO_ALLOWED_REDIRECTS/i;
const NO_ACCOUNT_HINT = /AirAccount/i;

export default function SsoStartPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ status: "working" });
  const [redirectUri, setRedirectUri] = useState("");
  // React 18/19 StrictMode double-invokes effects in dev; minting a second one-time code is
  // harmless (60s TTL, unused codes just expire) but pointless — run the handoff once.
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    const raw = new URLSearchParams(window.location.search).get("redirect_uri");
    if (!raw) {
      setPhase({ status: "error", kind: "missingRedirect" });
      return;
    }
    setRedirectUri(raw);

    if (!isAuthenticated()) {
      // Preserve the whole query string so login can hand control straight back here.
      const back = `/sso/start?redirect_uri=${encodeURIComponent(raw)}`;
      router.replace(`/auth/login?redirect=${encodeURIComponent(back)}`);
      return;
    }

    try {
      const { data } = await ssoAPI.authorize(raw);
      let target: URL;
      try {
        // Build on the backend-echoed (validated + normalized) URI, and use URLSearchParams so
        // the `code` is appended with "?" or "&" correctly even when it already carries a query.
        target = new URL(data.redirectUri);
      } catch {
        setPhase({ status: "error", kind: "badRedirect", detail: data.redirectUri });
        return;
      }
      target.searchParams.set("code", data.code);
      // replace(), not assign(): the SSO start URL must not sit in history — going "back" to it
      // would re-mint a code and bounce the user around.
      window.location.replace(target.toString());
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string | string[] } };
        message?: string;
      };
      const status = err.response?.status;
      const raw2 = err.response?.data?.message;
      const detail = Array.isArray(raw2) ? raw2.join("; ") : raw2;

      if (status === undefined) {
        setPhase({ status: "error", kind: "network", detail: err.message });
      } else if (status === 401) {
        setPhase({ status: "error", kind: "unauthorized", detail });
      } else if (status === 400 && detail && WHITELIST_HINT.test(detail)) {
        setPhase({ status: "error", kind: "notWhitelisted", detail });
      } else if (status === 400 && detail && NO_ACCOUNT_HINT.test(detail)) {
        setPhase({ status: "error", kind: "noAccount", detail });
      } else {
        setPhase({ status: "error", kind: "unknown", detail: detail ?? err.message });
      }
    }
  }, [router]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  if (phase.status === "working") {
    return (
      <Layout>
        <div className="flex items-start justify-center px-4 pt-24 pb-8 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-500" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("ssoStart.title")}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("ssoStart.working")}</p>
            {redirectUri && (
              <p className="mt-4 break-all font-mono text-xs text-gray-400 dark:text-gray-500">
                {redirectUri}
              </p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  const isWhitelist = phase.kind === "notWhitelisted";
  const message = isWhitelist
    ? t("ssoStart.error.notWhitelisted", { uri: redirectUri })
    : t(`ssoStart.error.${phase.kind}`);

  return (
    <Layout>
      <div className="flex items-start justify-center px-4 pt-24 pb-8 sm:px-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-xl dark:border-red-900 dark:bg-gray-800">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-400">
            {t("ssoStart.error.title")}
          </h1>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{message}</p>

          {isWhitelist && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {t("ssoStart.error.opsHint")}
            </p>
          )}

          {phase.detail && (
            <p className="mt-4 break-all rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              {t("ssoStart.error.detailLabel")}: {phase.detail}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {phase.kind === "unauthorized" && (
              <Link
                href={`/auth/login?redirect=${encodeURIComponent(
                  `/sso/start?redirect_uri=${encodeURIComponent(redirectUri)}`
                )}`}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {t("ssoStart.signInAgain")}
              </Link>
            )}
            {phase.kind === "noAccount" && (
              <Link
                href="/dashboard"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {t("ssoStart.createAccount")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t("ssoStart.back")}
            </button>
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {t("ssoStart.home")}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
