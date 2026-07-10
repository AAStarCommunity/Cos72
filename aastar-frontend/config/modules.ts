/**
 * Module contract addresses (Phase 0 §0.3, transition).
 *
 * SDK canonical has no entries for the module contracts (TaskEscrow / Jury /
 * MyShops …) yet, and adding them to the SDK is deferred. So during the
 * transition we deploy each module's contracts to Sepolia in their own source
 * repo, copy the ABI into `lib/contracts/`, and point at the deployed address
 * via `.env` here. Once the SDK grows canonical entries, swap these for
 * `lib/addresses.ts`.
 *
 * NOTE: MyTask does NOT get its own MySBT address — it uses the ecosystem SBT
 * (`infraAddresses().sbt`), per the drop-custom-MySBT decision.
 *
 * @module config/modules
 */
import type { Address } from "viem";

const env = (k: string): Address | undefined =>
  (process.env[k] ? (process.env[k] as Address) : undefined);

export const MODULE_ADDRESSES = {
  // MyTask (deploy TaskEscrowV2, not v1) — source: ~/Dev/mycelium/MyTask
  taskEscrow: env("NEXT_PUBLIC_TASK_ESCROW_ADDRESS"),
  juryContract: env("NEXT_PUBLIC_JURY_CONTRACT_ADDRESS"),
  // MyShop — source: ~/Dev/mycelium/MyShop
  myShops: env("NEXT_PUBLIC_MYSHOPS_ADDRESS"),
  myShopItems: env("NEXT_PUBLIC_MYSHOP_ITEMS_ADDRESS"),
} as const;

export type ModuleAddresses = typeof MODULE_ADDRESSES;
