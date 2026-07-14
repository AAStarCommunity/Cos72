/**
 * Same-origin return-path guard for `?redirect=` login round-trips.
 *
 * Flows that bounce through /auth/login (e.g. /sso/start) pass the URL to resume on as a
 * `?redirect=` query param. After sign-in the login page does `router.push(returnTo)` — so
 * `returnTo` is a navigation SINK and MUST be proven same-origin, or `?redirect=` becomes an
 * open redirect (phishing: land the freshly-authenticated user on an attacker origin).
 *
 * A naive "starts with '/' and not '//'" check is NOT enough. `URLSearchParams.get()` decodes
 * percent-encoding first, so `?redirect=/%09//evil.com` arrives here as `/\t//evil.com`, and
 * `?redirect=/%0d%0a//evil.com` as `/\r\n//evil.com`. Both pass a naive prefix check, yet the
 * WHATWG URL parser STRIPS leading tab/CR/LF and then reads `//evil.com` as a
 * protocol-relative authority → `https://evil.com/`. Backslash is likewise folded to `/` by
 * many stacks. Defense here is layered:
 *
 *   1. reject any C0 control char or space (codepoint <= 0x20) and any backslash — these are
 *      exactly the characters URL parsers strip/fold to smuggle in an authority;
 *   2. require a single leading "/" (reject "//…", the protocol-relative form), and reject
 *      percent-encoded path separators (`%2f`/`%5c`) that a downstream decoder could fold into
 *      an authority;
 *   3. AUTHORITATIVE: resolve against the real origin with the WHATWG URL parser and demand
 *      `url.origin === origin`. Whatever survives (1)+(2) is normalized here, and a value that
 *      resolves off-origin is rejected. The returned string is the parser's own
 *      pathname+search+hash — never the raw input — so nothing un-normalized reaches the sink.
 *
 * @param raw    the decoded `?redirect=` value (or null)
 * @param origin same-origin to enforce against; defaults to `window.location.origin`. Passed
 *               explicitly by tests (Node has no `window`); callers in the browser omit it.
 * @returns a normalized same-origin `path+search+hash`, or null if `raw` is unusable.
 */
export function safeReturnPath(raw: string | null | undefined, origin?: string): string | null {
  if (!raw) return null;

  // (1) No control chars / space / backslash — the smuggling alphabet for authority injection.
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x20 || code === 0x5c /* \ */) return null;
  }

  // (2) Must be a rooted path, not a protocol-relative `//host` authority.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;

  // (2b) Reject percent-encoded path separators (`%2f` = /, `%5c` = \). The WHATWG URL parser
  // leaves them encoded, so `/%2f%2fevil.com` stays same-origin HERE — but a downstream router
  // or proxy that decodes the path first would fold it to `//evil.com` (an authority). Same
  // fail-closed stance the backend takes in resolveRedirect's ENCODED_PATH_SEPARATOR; a real
  // return path never needs an encoded separator.
  if (/%2f|%5c/i.test(raw)) return null;

  // (3) Authoritative same-origin check via the WHATWG URL parser.
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!base) return null;
  try {
    const url = new URL(raw, base);
    if (url.origin !== base) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
