import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { AccountService } from "../account/account.service";
import { SSO_TOKEN_AUDIENCE, SSO_TOKEN_TTL_SECONDS } from "./sso.constants";

/**
 * MyVote SSO channel (MV-1, cos72 half).
 *
 * Flow: the user is logged into cos72 (cos72 JWT) → POST /sso/authorize mints a one-time
 * code bound to { userId, aaAddress } → the browser is redirected to MyVote with that code →
 * MyVote calls POST /sso/exchange to swap it for a short-lived SSO session token (separate
 * secret + audience "myvote", NOT interchangeable with the cos72 session JWT) → MyVote
 * backend/edge validates it via GET /sso/verify.
 *
 * The KMS-side signTypedData API (the other half of MV-1) is delivered separately as E-5.
 */

interface SsoCodeEntry {
  userId: string;
  aaAddress: string;
  /** Normalized redirect_uri the code was authorized for — exchange must present the same one. */
  redirectUri: string;
  issuedAt: number;
  expiresAt: number;
}

/** One-time authorization code TTL — just long enough for a browser redirect round-trip. */
const CODE_TTL_MS = 60_000;
/** Periodic sweep of expired codes (codes are also validated on consumption). */
const SWEEP_MS = 60_000;
/**
 * Hard cap on outstanding codes. /sso/authorize is JWT-guarded so only authenticated users
 * can mint codes, but a hostile logged-in client could still loop — the cap bounds memory
 * (oldest-inserted entries are evicted first; worst case a pending login redirect is retried).
 */
const MAX_CODES = 10_000;

/**
 * Single unified error for every exchange failure (unknown / consumed / expired code,
 * redirect_uri mismatch): one status + one message, so the endpoint cannot be used as an
 * oracle to distinguish "code exists but expired" from "code never existed" etc.
 */
const INVALID_SSO_CODE = "Invalid SSO code";

@Injectable()
export class SsoService implements OnModuleDestroy {
  private readonly ssoJwtSecret: string;
  private readonly allowedRedirects: string[];

  // In-memory one-time-code store. Codes live for 60s and are consumed exactly once, so
  // persistence is unnecessary. NOTE: per-process memory — correct for the current
  // single-instance deployment; a multi-replica deployment must move this to a shared
  // backend (e.g. Redis with GETDEL), or a code minted on one replica would be
  // unredeemable on another.
  private readonly codes = new Map<string, SsoCodeEntry>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly accountService: AccountService
  ) {
    // Independent secret from the cos72 session JWT_SECRET, so an SSO token can never be
    // replayed against cos72 APIs (and vice versa). Fail fast at boot when unset — a
    // missing secret must never silently fall back to the session secret or a default.
    const secret = this.configService.get<string>("SSO_JWT_SECRET");
    if (!secret) {
      throw new Error("SSO_JWT_SECRET environment variable is required");
    }
    // Enforce the isolation, don't just document it: a shared secret would make SSO tokens
    // and cos72 session tokens cryptographically interchangeable.
    const sessionSecret = this.configService.get<string>("JWT_SECRET");
    if (sessionSecret && sessionSecret === secret) {
      throw new Error("SSO_JWT_SECRET must differ from JWT_SECRET (token-domain isolation)");
    }
    this.ssoJwtSecret = secret;

    // Fail-closed whitelist: empty/unset env means every redirect_uri is rejected.
    this.allowedRedirects = (this.configService.get<string>("SSO_ALLOWED_REDIRECTS") ?? "")
      .split(",")
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);

    this.sweeper = setInterval(() => this.sweepExpired(), SWEEP_MS);
    // Don't keep the event loop (or the test runner / graceful shutdown) alive for the sweep.
    this.sweeper.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  /**
   * Mints a one-time SSO code for the (JWT-authenticated) user. `redirectUri` must match the
   * SSO_ALLOWED_REDIRECTS whitelist (see resolveRedirect for the matching rules). The code is
   * bound to the normalized redirect_uri — exchange must present the exact same one (OAuth
   * code↔redirect binding), so a stolen code can't be redeemed under a different redirect.
   */
  async authorize(
    userId: string,
    redirectUri: string
  ): Promise<{ code: string; redirectUri: string }> {
    const normalizedRedirect = this.resolveRedirect(redirectUri);

    let aaAddress: string;
    try {
      aaAddress = await this.accountService.getAccountAddress(userId);
    } catch (_error) {
      throw new BadRequestException(
        "User has no AirAccount yet — create the ERC-4337 account before using MyVote SSO"
      );
    }

    const code = randomBytes(32).toString("hex");
    const now = Date.now();
    this.evictIfOverCap();
    this.codes.set(code, {
      userId,
      aaAddress,
      redirectUri: normalizedRedirect,
      issuedAt: now,
      expiresAt: now + CODE_TTL_MS,
    });

    return { code, redirectUri: normalizedRedirect };
  }

  /**
   * Swaps a one-time code for a short-lived SSO session token. The presented redirect_uri
   * must exactly match (after URL normalization) the one the code was authorized for.
   *
   * The get+delete pair below is two synchronous operations with no await in between —
   * atomic under Node's single-threaded event loop, so a code can never be redeemed twice
   * even under concurrent requests. Any failed attempt (expired / redirect mismatch) also
   * burns the code, per OAuth one-time-code semantics.
   */
  exchange(
    code: string,
    redirectUri: string
  ): { token: string; aaAddress: string; expiresIn: number } {
    const entry = this.codes.get(code);
    this.codes.delete(code); // consume unconditionally: single-use even when the attempt fails

    // Normalize the presented redirect_uri exactly like authorize stored it; a value that
    // doesn't parse can never match (fail-closed).
    let presentedRedirect: string | null = null;
    try {
      presentedRedirect = new URL(redirectUri).toString();
    } catch (_error) {
      presentedRedirect = null;
    }

    const valid =
      entry !== undefined &&
      entry.expiresAt > Date.now() &&
      presentedRedirect !== null &&
      entry.redirectUri === presentedRedirect;

    if (!valid) {
      throw new UnauthorizedException(INVALID_SSO_CODE);
    }

    const token = this.jwtService.sign(
      { sub: entry.userId, aa: entry.aaAddress },
      {
        secret: this.ssoJwtSecret,
        algorithm: "HS256",
        audience: SSO_TOKEN_AUDIENCE,
        expiresIn: SSO_TOKEN_TTL_SECONDS,
      }
    );

    return { token, aaAddress: entry.aaAddress, expiresIn: SSO_TOKEN_TTL_SECONDS };
  }

  /**
   * Validates an SSO session token (secret + audience + expiry). Non-throwing by design:
   * MyVote's backend/edge polls this, so a bad token is a `{ valid: false }` answer, not a 401.
   */
  verify(token: string): { valid: boolean; aaAddress: string | null } {
    try {
      const payload = this.jwtService.verify<{ sub: string; aa: string }>(token, {
        secret: this.ssoJwtSecret,
        algorithms: ["HS256"], // pin the algorithm — never trust the token header's alg
        audience: SSO_TOKEN_AUDIENCE,
      });
      return { valid: true, aaAddress: payload.aa ?? null };
    } catch (_error) {
      return { valid: false, aaAddress: null };
    }
  }

  /**
   * Validates redirect_uri against SSO_ALLOWED_REDIRECTS and returns its normalized form.
   * Matching rules (both sides URL-parsed, never raw-string prefixed):
   * - origin must be exactly equal (so `https://myvote.example.com.evil.com` can't pass a
   *   `https://myvote.example.com` entry), AND
   * - pathname must match on a path-segment boundary: equal to the entry's path, or start
   *   with entryPath + "/" (so a `/sso/callback` entry admits `/sso/callback/sub` but NOT
   *   `/sso/callback-evil`). Entry paths are normalized by stripping trailing slashes; a
   *   bare-origin entry admits every path on that origin.
   */
  private resolveRedirect(redirectUri: string): string {
    let target: URL;
    try {
      target = new URL(redirectUri);
    } catch (_error) {
      throw new BadRequestException("redirect_uri must be an absolute URL");
    }

    const allowed = this.allowedRedirects.some(entry => {
      let entryUrl: URL;
      try {
        entryUrl = new URL(entry);
      } catch (_error) {
        return false; // malformed whitelist entry never matches (fail-closed)
      }
      if (target.origin !== entryUrl.origin) return false;
      const entryPath = entryUrl.pathname.replace(/\/+$/, ""); // "" = bare origin, admits all paths
      return target.pathname === entryPath || target.pathname.startsWith(`${entryPath}/`);
    });

    if (!allowed) {
      throw new BadRequestException("redirect_uri is not in the SSO_ALLOWED_REDIRECTS whitelist");
    }

    return target.toString();
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt <= now) this.codes.delete(code);
    }
  }

  private evictIfOverCap(): void {
    if (this.codes.size < MAX_CODES) return;
    this.sweepExpired();
    let toDrop = this.codes.size - MAX_CODES + 1;
    for (const code of this.codes.keys()) {
      if (toDrop <= 0) break;
      this.codes.delete(code);
      toDrop--;
    }
  }
}
