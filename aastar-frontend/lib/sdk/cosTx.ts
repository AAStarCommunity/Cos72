/**
 * cosSend / cosRead — Cos72's single gasless write + read path (Phase 0 §0.2).
 *
 * Cos72 is AirAccount-only (no `window.ethereum`, no EOA). Every module write
 * that used to call `walletClient.writeContract(...)` goes through `cosSend`.
 * Because KMS is server-only, the sponsored UserOp is prepared + submitted by the
 * backend (`/userop/*`); the browser only runs the tier-appropriate passkey
 * ceremony. This mirrors, 1:1, the proven transfer flow (`app/transfer/page.tsx`)
 * — ALL tiers: Tier-1 KMS owner ceremony, Tier-2/3 device-passkey, Tier-3 guardian
 * co-sign, and the Scheme-2 DVT out-of-band confirmation. Reads use a public
 * client over the user-configured RPC, no signing.
 *
 * @module lib/sdk/cosTx
 */
import { encodeFunctionData } from "viem";
import type { Abi, Address, Hash, Hex } from "viem";
import { startAuthentication } from "@simplewebauthn/browser";
import { resolveTransfer } from "@aastar/sdk/airaccount";
import { ensureSdkConfig, getPublicClient } from "./client";
import { userOpAPI } from "@/lib/api";
import {
  assertUserOpHash,
  collectGuardianSignature,
  runDvtConfirmation,
} from "@/lib/webauthn-assert";

/** A single contract call — the unit every module hands to cosSend/cosRead. */
export interface ContractCall {
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** Native value (wei) for payable calls. */
  value?: bigint;
}

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Gasless write, all tiers. Resolves the account's tier, prepares a sponsored
 * UserOp on the backend, runs the tier-appropriate ceremony, submits, handles a
 * DVT out-of-band withhold, then polls for the on-chain tx hash. Replaces every
 * module's `walletClient.writeContract(...)`.
 *
 * SECURITY — trust boundary (PR #1 review note 1): the passkey signs
 * `prep.userOpHash` (Tier-2/3) or the SDK-computed commitment (Tier-1) exactly as
 * the backend returned it. The browser cannot independently recompute the hash
 * (it lacks the assembled op), so the binding to `{to,data,value}` is only as
 * trustworthy as the backend. Inherent to the KMS-server-only model; acceptable
 * for AirAccount-only with our own backend. Future hardening: echo the decoded op
 * for the user to confirm before the ceremony.
 */
export async function cosSend(call: ContractCall, account: Address): Promise<Hash> {
  ensureSdkConfig();
  const publicClient = getPublicClient();
  const data = encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args as unknown[] | undefined,
  });
  const value = call.value ?? 0n;

  // 1) Resolve the tier client-side (same as the transfer page) to pick the path.
  let tier: number | null = null;
  try {
    const res = await resolveTransfer({
      client: publicClient as never,
      account,
      amount: value,
      token: "ETH",
    });
    tier = res.tier;
  } catch {
    /* keep null → Tier-1 KMS ceremony path */
  }
  const useWebAuthnPasskey = (tier ?? 1) >= 2;

  // 2) Prepare the sponsored UserOp.
  const { data: prep } = await userOpAPI.prepare({
    to: call.to,
    data,
    value: value.toString(),
    useWebAuthnPasskey,
  });

  // 3) Ceremony — branch on whether the SDK returned a KMS commitment.
  const isWebAuthnPath = !prep.publicKeyOptions;
  let deviceWebAuthn: unknown;
  let credential: unknown;
  if (isWebAuthnPath) {
    deviceWebAuthn = await assertUserOpHash(prep.userOpHash as Hex);
  } else {
    // Tier-1 KMS owner ceremony: sign the SDK-computed commitment verbatim.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    credential = await startAuthentication({ optionsJSON: prep.publicKeyOptions as any });
  }

  // 4) Tier-3 guardian co-sign over the userOpHash.
  let guardianSignature: string | undefined;
  if ((prep.requiredSigs?.guardian ?? 0) > 0) {
    guardianSignature = await collectGuardianSignature(prep.userOpHash as Hex);
  }

  // 5) Submit (payload discriminated by path).
  const submitPayload = isWebAuthnPath
    ? { opId: prep.opId, deviceWebAuthn, guardianSignature }
    : { opId: prep.opId, challengeId: prep.challengeId, credential, guardianSignature };
  let { data: res } = await userOpAPI.submit(submitPayload);

  // 6) Scheme-2: DVT withheld its co-sig → approve out-of-band + resubmit.
  if (res?.pendingConfirmation && res.userOpHash && res.nodeEndpoint) {
    const ok = await runDvtConfirmation(res.userOpHash, res.nodeEndpoint);
    if (!ok) throw new Error("Out-of-band confirmation was rejected or expired.");
    ({ data: res } = await userOpAPI.submit(submitPayload));
  }

  // 7) Poll status for the on-chain tx hash (submit returns pending; op lands async).
  if (res?.transactionHash) return res.transactionHash as Hash;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const { data: st } = await userOpAPI.getStatus(prep.opId);
    if (st?.transactionHash) return st.transactionHash as Hash;
    if (st?.status === "failed") throw new Error(`UserOp failed${st.error ? ": " + st.error : ""}`);
  }
  throw new Error("UserOp timed out waiting for transactionHash");
}
