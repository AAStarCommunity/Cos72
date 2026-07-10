/**
 * cosSend / cosRead — Cos72's single gasless write + read path (Phase 0 §0.2).
 *
 * Cos72 is AirAccount-only (no `window.ethereum`, no EOA). Every module write
 * that used to call `walletClient.writeContract(...)` goes through `cosSend`:
 * because KMS is server-only, the write is prepared + submitted by the backend
 * (sponsored UserOp via SuperPaymaster), and the browser only produces a passkey
 * (WebAuthn) assertion over the prepared `userOpHash`. Reads use a public client
 * over the user-configured RPC (`config/brand.ts` / Settings), no signing.
 *
 * @module lib/sdk/cosTx
 */
import { encodeFunctionData } from "viem";
import type { Abi, Address, Hash, Hex } from "viem";
import { ensureSdkConfig, getPublicClient } from "./client";
import { userOpAPI } from "@/lib/api";

/** A single contract call — the unit every module hands to cosSend/cosRead. */
export interface ContractCall {
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** Native value (wei) for payable calls. */
  value?: bigint;
}

/**
 * Produce a passkey (WebAuthn) assertion whose challenge = the prepared
 * `userOpHash`. Supplied by the session layer (§0.1) so cosSend stays
 * transport-agnostic and testable. Returns whatever the backend `submit`
 * endpoint expects as `deviceWebAuthn`.
 */
export type SignUserOpHash = (userOpHash: Hex) => Promise<unknown>;

/** Read a contract via a public client (brand.ts RPC). No account, no signing. */
export async function cosRead<T = unknown>(
  call: Pick<ContractCall, "to" | "abi" | "functionName" | "args">
): Promise<T> {
  ensureSdkConfig();
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: call.to,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args as unknown[] | undefined,
  }) as Promise<T>;
}

/**
 * Gasless write. Encodes the call → backend prepares a sponsored UserOp and
 * returns its `userOpHash` → the browser signs that hash via passkey → backend
 * submits (KMS/BLS-signs + bundler). Returns the on-chain tx hash.
 *
 * This is the one place module writes converge; swapping the sponsorship/bundler
 * strategy later is a backend concern, invisible to callers.
 *
 * SECURITY — trust boundary (PR #1 review note 1): the passkey signs
 * `prepared.userOpHash` exactly as the backend returned it. The browser cannot
 * independently recompute that hash (it lacks the fully-assembled sponsored op),
 * so the signature's binding to `{to,data,value}` is only as trustworthy as the
 * backend. This is inherent to the KMS-server-only / backend-prepares-the-UserOp
 * model and acceptable for AirAccount-only with our own backend. Future
 * hardening: have `prepare` echo the decoded op for the user to confirm before
 * the passkey ceremony.
 */
export async function cosSend(call: ContractCall, sign: SignUserOpHash): Promise<Hash> {
  const data = encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args as unknown[] | undefined,
  });
  const { data: prepared } = await userOpAPI.prepare({
    to: call.to,
    data,
    value: call.value?.toString(),
  });
  const deviceWebAuthn = await sign(prepared.userOpHash as Hex);
  const { data: submitted } = await userOpAPI.submit({ opId: prepared.opId, deviceWebAuthn });
  return submitted.txHash as Hash;
}
