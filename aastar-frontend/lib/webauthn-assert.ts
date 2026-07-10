/**
 * Passkey (WebAuthn) assertion over a `userOpHash` — the browser half of every
 * Cos72 gasless write (Phase 0 §0.1/§0.2).
 *
 * Extracted from `app/transfer/page.tsx` so the shared session (`cosSend`) and
 * any module can reuse the exact same ceremony instead of re-deriving it. Runs
 * ONE `navigator.credentials.get()` with `challenge = userOpHash` (32 raw
 * bytes) and normalises the assertion into the encodings the backend / SDK's
 * `packWebAuthnBlob` expect:
 *   - authenticatorData, signature: 0x-hex
 *   - clientDataJSON: RAW JSON text (`{"type":"webauthn.get","challenge":"…}`)
 *
 * @module lib/webauthn-assert
 */
import { startAuthentication } from "@simplewebauthn/browser";
import type { Hex } from "viem";
import { webauthnRpId } from "@/lib/webauthn-rp";

export type DeviceWebAuthn = {
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
};

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 =
    b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let h = "0x";
  for (const b of bytes) h += b.toString(16).padStart(2, "0");
  return h;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Run the passkey ceremony over `userOpHash` and return the normalised
 * assertion. Suitable as the `SignUserOpHash` callback for `cosSend`.
 */
export async function assertUserOpHash(userOpHash: Hex): Promise<DeviceWebAuthn> {
  const assertion = await startAuthentication({
    optionsJSON: {
      challenge: bufToB64url(hexToBytes(userOpHash)),
      rpId: webauthnRpId(),
      userVerification: "required",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  const r = assertion.response;
  return {
    authenticatorData: bytesToHex(b64urlToBytes(r.authenticatorData)),
    clientDataJSON: new TextDecoder().decode(b64urlToBytes(r.clientDataJSON)),
    signature: bytesToHex(b64urlToBytes(r.signature)),
  };
}
