/**
 * Unit tests for {@link safeReturnPath} — the open-redirect guard for `?redirect=` login
 * round-trips (MV-7). Run with the built-in Node test runner via ts-node:
 *
 *   npm run test:unit -w aastar-frontend
 *
 * These are the exact bypass payloads Codex flagged as Critical (control-char authority
 * smuggling: a value that passes a naive prefix check but the WHATWG URL parser strips/folds
 * into an off-origin authority), plus the plain protocol-relative / absolute forms and the
 * legitimate same-origin paths that must still be honored.
 *
 * NOTE: `.ts` import extension + node:test means this file is intentionally EXCLUDED from the
 * app's `tsconfig.json` (see its `exclude`) so `tsc --noEmit` / `next build` don't try to
 * compile it under `moduleResolution: bundler`. ts-node handles it at test time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "./safe-return-path.ts";

const ORIGIN = "https://cos72.example";

test("safeReturnPath rejects open-redirect payloads", () => {
  const rejected: Array<[string, string]> = [
    ["//evil.com", "protocol-relative authority"],
    ["/\\evil.com", "backslash-folded authority"],
    ["/%2f%2fevil.com", "URLSearchParams decodes to /\\evil... already; here raw //"],
    ["%2F%2Fevil.com", "no leading slash after decode"],
    ["/\t//evil.com", "leading-tab smuggle (%09 decoded) → parser strips tab"],
    ["/\r\n//evil.com", "CR/LF smuggle (%0d%0a decoded) → parser strips CR/LF"],
    ["https://evil.com", "absolute URL, different origin"],
    ["http://cos72.example.evil.com/", "look-alike host"],
    ["\\\\evil.com", "backslash authority"],
    [" /dashboard", "leading space"],
  ];
  for (const [payload, why] of rejected) {
    assert.equal(
      safeReturnPath(payload, ORIGIN),
      null,
      `should reject: ${why} (${JSON.stringify(payload)})`
    );
  }
});

test("safeReturnPath handles the raw percent-encoded bypass strings after decode", () => {
  // What the browser hands us after URLSearchParams.get() decodes the query. `/%09//evil.com`
  // → `/\t//evil.com`; `/%0d%0a//evil.com` → `/\r\n//evil.com`. Both must be null.
  assert.equal(safeReturnPath("/\t//evil.com", ORIGIN), null);
  assert.equal(safeReturnPath("/\r\n//evil.com", ORIGIN), null);
});

test("safeReturnPath honors legitimate same-origin paths", () => {
  assert.equal(safeReturnPath("/dashboard", ORIGIN), "/dashboard");
  assert.equal(safeReturnPath("/sso/start?redirect_uri=x", ORIGIN), "/sso/start?redirect_uri=x");
  assert.equal(safeReturnPath("/proposal/0xabc#frag", ORIGIN), "/proposal/0xabc#frag");
});

test("safeReturnPath returns null for empty / nullish input", () => {
  assert.equal(safeReturnPath(null, ORIGIN), null);
  assert.equal(safeReturnPath(undefined, ORIGIN), null);
  assert.equal(safeReturnPath("", ORIGIN), null);
});
