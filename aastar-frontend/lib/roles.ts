/**
 * On-chain role reads (Phase 0 §0.4) — drive the role-gated navigation.
 *
 * Reads the connected account's protocol roles from the canonical Registry and
 * folds them into `RoleFlags`. Pure client-side read (no signing). The nav uses
 * these to decide which L2 community tabs are visible (owner sees 治理/发币;
 * members see 任务/商店/投票) — see `components/nav/CommunityNav`.
 *
 * @module lib/roles
 */
import {
  ROLE_ANODE,
  ROLE_COMMUNITY,
  ROLE_DVT,
  ROLE_ENDUSER,
  ROLE_KMS,
  ROLE_PAYMASTER_AOA,
  ROLE_PAYMASTER_SUPER,
  registryActions,
} from "@aastar/sdk/core";
import type { Address, Hex } from "viem";
import { ensureSdkConfig, getPublicClient } from "./sdk/client";
import { infraAddresses } from "./addresses";

export interface RoleFlags {
  /** ROLE_COMMUNITY — community owner (sees 治理 / 发币). */
  community: boolean;
  /** ROLE_ENDUSER — registered end user. */
  endUser: boolean;
  /**
   * Any infra/operator role (paymaster / DVT / KMS / ANODE). NOTE: infra/operator
   * flows are the EOA track (jason: infra 参与者本身没有 AirAccount), distinct from
   * the AirAccount user layer — the nav routes these to the operator area.
   */
  operator: boolean;
  /** Raw role ids held by the account. */
  roleIds: Hex[];
}

export const EMPTY_ROLES: RoleFlags = {
  community: false,
  endUser: false,
  operator: false,
  roleIds: [],
};

/** Read the account's protocol roles from the canonical Registry. */
export async function readRoles(user: Address): Promise<RoleFlags> {
  ensureSdkConfig();
  const publicClient = getPublicClient();
  const registry = infraAddresses().registry;
  // Same `as never` SDK-boundary bridge as lib/community.ts / buildGuardClient.
  const ext = publicClient.extend(registryActions(registry) as never) as unknown as {
    getUserRoles: (args: { user: Address }) => Promise<Hex[]>;
  };
  const roleIds = await ext.getUserRoles({ user });
  const has = (r: Hex) => roleIds.some((x) => x.toLowerCase() === r.toLowerCase());
  return {
    community: has(ROLE_COMMUNITY),
    endUser: has(ROLE_ENDUSER),
    operator: [ROLE_PAYMASTER_AOA, ROLE_PAYMASTER_SUPER, ROLE_DVT, ROLE_KMS, ROLE_ANODE].some(has),
    roleIds,
  };
}
