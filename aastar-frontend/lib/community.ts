/**
 * Community economics reads (Phase 0 §0.5) — xPNTs enumeration + credibility.
 *
 * Pure client-side reads over the configured RPC (no signing). Wraps the SDK's
 * xPNTs actions so modules (MyShop / MyVote / disclosure pages) can show a
 * community token's trust score / over-issuance without re-deriving the calls.
 *
 * @module lib/community
 */
import { xPNTsFactoryActions, xPNTsTokenActions, type Credibility } from "@aastar/sdk/core";
import type { Address } from "viem";
import { ensureSdkConfig, getPublicClient } from "./sdk/client";

export type { Credibility };

// The SDK action decorators want a narrower viem client type than the app's
// broad `PublicClient`; bridge at the SDK boundary (same `as never` pattern as
// `buildGuardClient` in lib/sdk/client.ts) rather than in call sites.

/** Enumerate the community xPNTs tokens deployed by a factory. */
export async function listCommunityTokens(factory: Address): Promise<Address[]> {
  ensureSdkConfig();
  const publicClient = getPublicClient();
  const ext = publicClient.extend(xPNTsFactoryActions(factory) as never) as unknown as {
    getAllTokens: () => Promise<Address[]>;
  };
  return ext.getAllTokens();
}

/**
 * Read a community token's economic-credibility snapshot (CC-33): 0–100 score,
 * over-issuance flag, and issued/backing/effective-cap USD (all five views pinned
 * to one block by the SDK). USD fields are 18-decimal fixed point.
 */
export async function readCredibility(token: Address): Promise<Credibility> {
  ensureSdkConfig();
  const publicClient = getPublicClient();
  const ext = publicClient.extend(xPNTsTokenActions() as never) as unknown as {
    getCredibility: (args: { token: Address }) => Promise<Credibility>;
  };
  return ext.getCredibility({ token });
}
