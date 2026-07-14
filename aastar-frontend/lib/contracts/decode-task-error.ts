/**
 * MT-11: decode TaskEscrowV2 custom-error reverts into i18n keys.
 *
 * The escrow reverts with 4-byte custom errors (`InvalidTaskState()`,
 * `ChallengePeriodExpired()`, …). Depending on where the failure surfaces the
 * frontend sees one of three shapes:
 *
 *  1. a viem `BaseError` wrapping `ContractFunctionRevertedError` (direct
 *     simulate/read paths) — walk it and take `errorName`;
 *  2. an `Error` whose message embeds the raw revert data as hex (the backend
 *     `/userop/*` path bubbles bundler/simulation output as text) — extract
 *     every hex blob and try `decodeErrorResult` against the escrow ABI;
 *  3. an `Error` whose message merely names the error (`"InvalidTaskState"`)
 *     — match known error names as words.
 *
 * Returns the mapped i18n key (`taskChallenge.errors.<Name>`) or `null` when
 * the failure isn't a recognized escrow error, so callers can fall back to the
 * raw message / a generic key.
 */
import { BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from "viem";
import { TASK_ESCROW_ABI } from "./task-escrow-abi";

/** Escrow custom errors with a dedicated EN/ZH message (see `taskChallenge.errors.*`). */
const MAPPED_ERROR_NAMES = new Set([
  "InvalidTaskState",
  "NotCommunity",
  "TaskExpired",
  "ChallengePeriodNotOver",
  "ChallengePeriodExpired",
  "AlreadyChallenged",
  "TransferFailed",
  "ZeroAmount",
  "ValidationsNotSatisfied",
  "PausedError",
]);

/** All error names declared in the ABI (for the plain-text word match). */
const ALL_ERROR_NAMES: string[] = TASK_ESCROW_ABI.filter(e => e.type === "error").map(e => e.name);

function keyFor(errorName: string | undefined): string | null {
  return errorName && MAPPED_ERROR_NAMES.has(errorName)
    ? `taskChallenge.errors.${errorName}`
    : null;
}

/** Shape 2: pull hex blobs out of an error message and try ABI decoding. */
function decodeFromHexInMessage(message: string): string | null {
  const hexes = message.match(/0x[0-9a-fA-F]{8,}/g) ?? [];
  for (const hex of hexes) {
    try {
      const decoded = decodeErrorResult({ abi: TASK_ESCROW_ABI, data: hex as Hex });
      const key = keyFor(decoded.errorName);
      if (key) return key;
    } catch {
      // not revert data for this ABI — try the next blob
    }
  }
  return null;
}

/** Shape 3: the message names the error in plain text (word-boundary match). */
function matchNameInMessage(message: string): string | null {
  for (const name of ALL_ERROR_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(message)) {
      const key = keyFor(name);
      if (key) return key;
    }
  }
  return null;
}

/**
 * Map a caught error to a `taskChallenge.errors.*` i18n key, or `null` when it
 * isn't a recognized TaskEscrowV2 revert (caller falls back to the raw
 * message or a generic key).
 */
export function decodeTaskErrorKey(err: unknown): string | null {
  // Shape 1: structured viem revert
  if (err instanceof BaseError) {
    const revert = err.walk(e => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const key = keyFor(revert.data?.errorName);
      if (key) return key;
    }
  }
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return null;
  return decodeFromHexInMessage(message) ?? matchNameInMessage(message);
}
