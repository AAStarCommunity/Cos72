import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Type,
  mixin,
} from "@nestjs/common";

// In-memory sliding-window rate limit keyed per (bucket, client IP), for the PUBLIC SSO
// endpoints (/sso/exchange is a code-guessing surface, /sso/verify a token-oracle surface).
// Modeled on auth/guards/otp-rate-limit.guard.ts, but IP-keyed since these endpoints carry
// no email/user identity before authentication.
//
// NOTE: per-process memory — correct for the single-instance backend. Multi-replica
// deployments must move the store to a shared backend (e.g. Redis).
//
// SCOPE: `req.ip` is the socket peer unless Express `trust proxy` is configured, so behind
// the Next.js rewrite / a reverse proxy all clients may share the proxy's IP (one shared
// budget). That is fail-closed (throttles too much, never too little); per-real-client
// limiting belongs at the edge.
const store = new Map<string, number[]>();

const MAX_WINDOW_MS = 60 * 60_000;
const SWEEP_MS = 10 * 60_000;
// Hard cap on tracked keys so spoofed/rotating source IPs can't grow the store unbounded
// (memory DoS). Eviction drops oldest-inserted keys — a few limit resets, never OOM.
const MAX_KEYS = 50_000;

const sweep = setInterval(() => {
  const cutoff = Date.now() - MAX_WINDOW_MS;
  for (const [key, hits] of store) {
    if (hits.length === 0 || hits[hits.length - 1] <= cutoff) store.delete(key);
  }
}, SWEEP_MS);
// Don't keep the event loop (or test runner / graceful shutdown) alive for the sweep.
sweep.unref?.();

function evictIfOverCap(): void {
  if (store.size <= MAX_KEYS) return;
  let toDrop = store.size - MAX_KEYS;
  for (const key of store.keys()) {
    store.delete(key);
    if (--toDrop <= 0) break;
  }
}

/**
 * Per-IP SSO rate-limit guard factory. `bucket` separates the exchange vs verify counters.
 * Exceeding `max` hits within `windowMs` yields a 429 with a `Retry-After` header.
 */
export function SsoRateLimit(bucket: string, max: number, windowMs: number): Type<CanActivate> {
  @Injectable()
  class SsoRateLimitGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const http = context.switchToHttp();
      const request = http.getRequest();
      const ip = String(request?.ip ?? request?.socket?.remoteAddress ?? "unknown");

      const key = `${bucket}:${ip}`;
      const now = Date.now();
      const hits = (store.get(key) ?? []).filter(t => t > now - windowMs);

      if (hits.length >= max) {
        store.set(key, hits); // persist the pruned window even when blocking
        const retrySec = Math.ceil((windowMs - (now - hits[0])) / 1000);
        http.getResponse()?.header?.("Retry-After", String(retrySec));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            message: `Too many SSO ${bucket} attempts. Try again in ${retrySec}s.`,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      hits.push(now);
      store.set(key, hits);
      evictIfOverCap();
      return true;
    }
  }
  return mixin(SsoRateLimitGuard);
}

// Test-only: reset the shared store between unit tests. No-ops in production so a stray
// import/call can't clear live rate-limit state.
export function __resetSsoRateLimit(): void {
  if (process.env.NODE_ENV === "production") return;
  store.clear();
}
