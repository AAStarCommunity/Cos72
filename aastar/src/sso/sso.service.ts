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

export const SSO_TOKEN_AUDIENCE = "myvote";
export const SSO_TOKEN_TTL_SECONDS = 600; // 10 min

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
   * SSO_ALLOWED_REDIRECTS whitelist: same origin as an entry AND prefixed by it — origins are
   * compared on parsed URLs so `https://myvote.example.evil.com` can't pass an
   * `https://myvote.example` entry.
   */
  async authorize(
    userId: string,
    redirectUri: string
  ): Promise<{ code: string; redirectUri: string }> {
    this.assertRedirectAllowed(redirectUri);

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
    this.codes.set(code, { userId, aaAddress, issuedAt: now, expiresAt: now + CODE_TTL_MS });

    return { code, redirectUri };
  }

  /**
   * Swaps a one-time code for a short-lived SSO session token. The get+delete pair below is
   * two synchronous operations with no await in between — atomic under Node's single-threaded
   * event loop, so a code can never be redeemed twice even under concurrent requests.
   */
  exchange(code: string): { token: string; aaAddress: string; expiresIn: number } {
    const entry = this.codes.get(code);
    this.codes.delete(code); // consume unconditionally: even an expired code is single-use

    if (!entry) {
      throw new UnauthorizedException("Invalid or already used SSO code");
    }
    if (entry.expiresAt <= Date.now()) {
      throw new UnauthorizedException("SSO code expired");
    }

    const token = this.jwtService.sign(
      { sub: entry.userId, aa: entry.aaAddress },
      {
        secret: this.ssoJwtSecret,
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
        audience: SSO_TOKEN_AUDIENCE,
      });
      return { valid: true, aaAddress: payload.aa ?? null };
    } catch (_error) {
      return { valid: false, aaAddress: null };
    }
  }

  private assertRedirectAllowed(redirectUri: string): void {
    let target: URL;
    try {
      target = new URL(redirectUri);
    } catch (_error) {
      throw new BadRequestException("redirect_uri must be an absolute URL");
    }

    const allowed = this.allowedRedirects.some(entry => {
      try {
        const entryUrl = new URL(entry);
        return target.origin === entryUrl.origin && redirectUri.startsWith(entry);
      } catch (_error) {
        return false; // malformed whitelist entry never matches (fail-closed)
      }
    });

    if (!allowed) {
      throw new BadRequestException("redirect_uri is not in the SSO_ALLOWED_REDIRECTS whitelist");
    }
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
