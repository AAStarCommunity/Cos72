/**
 * Canonical infra addresses (Phase 0 §0.3).
 *
 * Everything here comes from `@aastar/sdk` canonical — no hand-filled
 * `NEXT_PUBLIC_*_ADDRESS`. The SDK's address constants are chain-scoped: they
 * resolve to whatever chain `applyConfig` was called with, so read them THROUGH
 * `infraAddresses()` (which runs `ensureSdkConfig()` first) rather than importing
 * the bare constant at a call site. Module-contract addresses (TaskEscrow /
 * MyShops / …) aren't in SDK canonical yet — see `config/modules.ts`.
 *
 * @module lib/addresses
 */
import {
  AGENT_IDENTITY_REGISTRY_ADDRESS,
  AGENT_REPUTATION_REGISTRY_ADDRESS,
  APNTS_ADDRESS,
  COMMUNITY_SAFE,
  DVT_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  GTOKEN_ADDRESS,
  GTOKEN_STAKING_ADDRESS,
  PAYMASTER_V4_ADDRESS,
  REGISTRY_ADDRESS,
  REPUTATION_SYSTEM_ADDRESS,
  SBT_ADDRESS,
  SUPER_PAYMASTER_ADDRESS,
  XPNTS_FACTORY_ADDRESS,
  getCanonicalAddresses,
} from "@aastar/sdk/core";
import type { Address } from "viem";
import { ensureSdkConfig } from "./sdk/client";

/**
 * Canonical infra addresses for the configured chain. Call this (don't import
 * the bare SDK constants) so `ensureSdkConfig()` has run and the chain-scoped
 * bindings are resolved.
 */
export function infraAddresses() {
  ensureSdkConfig();
  return {
    registry: REGISTRY_ADDRESS as Address,
    gToken: GTOKEN_ADDRESS as Address,
    gTokenStaking: GTOKEN_STAKING_ADDRESS as Address,
    superPaymaster: SUPER_PAYMASTER_ADDRESS as Address,
    paymasterV4: PAYMASTER_V4_ADDRESS as Address,
    xPNTsFactory: XPNTS_FACTORY_ADDRESS as Address,
    // Ecosystem SBT — MyTask drops its own MySBT and uses this (Registry.registerRole).
    sbt: SBT_ADDRESS as Address,
    reputationSystem: REPUTATION_SYSTEM_ADDRESS as Address,
    aPNTs: APNTS_ADDRESS as Address,
    entryPoint: ENTRY_POINT_ADDRESS as Address,
    // ERC-8004 = SuperPaymaster ecosystem registries (jason: 用 SuperPaymaster 能力).
    agentIdentityRegistry: AGENT_IDENTITY_REGISTRY_ADDRESS as Address,
    agentReputationRegistry: AGENT_REPUTATION_REGISTRY_ADDRESS as Address,
    dvtValidator: DVT_VALIDATOR_ADDRESS as Address,
    // Governance owner-target — EOA during setup, transferOwnership here once stable.
    communitySafe: COMMUNITY_SAFE as Address,
  } as const;
}

export { getCanonicalAddresses, COMMUNITY_SAFE, DVT_VALIDATOR_ADDRESS };
