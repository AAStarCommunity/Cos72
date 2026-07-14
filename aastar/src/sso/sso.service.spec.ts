import { BadRequestException, HttpException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";

// Mock the account module so this spec doesn't load its real import chain
// (sdk.providers → auth.service → ESM-only `uuid`), which Jest cannot parse.
// SsoService only calls accountService.getAccountAddress(userId).
jest.mock("../account/account.service", () => ({
  AccountService: class AccountService {},
}));

import { AccountService } from "../account/account.service";
import { JwtStrategy } from "../auth/strategies/jwt.strategy";
import { SsoRateLimit, __resetSsoRateLimit } from "./guards/sso-rate-limit.guard";
import { SSO_TOKEN_AUDIENCE, SSO_TOKEN_TTL_SECONDS } from "./sso.constants";
import { SsoService } from "./sso.service";

const TEST_SECRET = "test-sso-secret";
const SESSION_SECRET = "test-session-secret";
const ALLOWED = "https://myvote.example.com,http://localhost:5175/sso/callback";
const AA_ADDRESS = "0x1111111111111111111111111111111111111111";
const USER_ID = "user-1";
const REDIRECT = "https://myvote.example.com/cb";

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn().mockImplementation((key: string) => env[key]),
  } as unknown as ConfigService;
}

const accountServiceMock = {
  getAccountAddress: jest.fn().mockResolvedValue(AA_ADDRESS),
};

describe("SsoService", () => {
  let service: SsoService;
  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    accountServiceMock.getAccountAddress.mockResolvedValue(AA_ADDRESS);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        JwtService,
        {
          provide: ConfigService,
          useValue: makeConfig({
            SSO_JWT_SECRET: TEST_SECRET,
            JWT_SECRET: SESSION_SECRET,
            SSO_ALLOWED_REDIRECTS: ALLOWED,
          }),
        },
        { provide: AccountService, useValue: accountServiceMock },
      ],
    }).compile();

    service = module.get<SsoService>(SsoService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    service.onModuleDestroy(); // clear the sweep interval
    jest.useRealTimers();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("fails fast at construction when SSO_JWT_SECRET is missing", () => {
    expect(
      () =>
        new SsoService(
          makeConfig({ SSO_ALLOWED_REDIRECTS: ALLOWED }),
          jwtService,
          accountServiceMock as unknown as AccountService
        )
    ).toThrow("SSO_JWT_SECRET environment variable is required");
  });

  it("fails fast when SSO_JWT_SECRET equals JWT_SECRET (token-domain isolation)", () => {
    expect(
      () =>
        new SsoService(
          makeConfig({
            SSO_JWT_SECRET: "same-secret",
            JWT_SECRET: "same-secret",
            SSO_ALLOWED_REDIRECTS: ALLOWED,
          }),
          jwtService,
          accountServiceMock as unknown as AccountService
        )
    ).toThrow("SSO_JWT_SECRET must differ from JWT_SECRET");
  });

  describe("authorize — redirect whitelist (fail-closed)", () => {
    it("rejects every redirect when SSO_ALLOWED_REDIRECTS is unset", async () => {
      const closed = new SsoService(
        makeConfig({ SSO_JWT_SECRET: TEST_SECRET, JWT_SECRET: SESSION_SECRET }),
        jwtService,
        accountServiceMock as unknown as AccountService
      );
      await expect(closed.authorize(USER_ID, REDIRECT)).rejects.toThrow(BadRequestException);
      closed.onModuleDestroy();
    });

    it("rejects a redirect_uri outside the whitelist", async () => {
      await expect(service.authorize(USER_ID, "https://evil.example.com/cb")).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects a lookalike origin that merely embeds an allowed host", async () => {
      await expect(
        service.authorize(USER_ID, "https://myvote.example.com.evil.com/cb")
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-URL redirect_uri", async () => {
      await expect(service.authorize(USER_ID, "not-a-url")).rejects.toThrow(BadRequestException);
    });

    it("accepts a whitelisted redirect_uri and mints a 32-byte hex code", async () => {
      const result = await service.authorize(USER_ID, "https://myvote.example.com/sso/callback");
      expect(result.redirectUri).toBe("https://myvote.example.com/sso/callback");
      expect(result.code).toMatch(/^[0-9a-f]{64}$/);
    });

    it("rejects when the user has no AirAccount", async () => {
      accountServiceMock.getAccountAddress.mockRejectedValue(new Error("no account"));
      await expect(service.authorize(USER_ID, REDIRECT)).rejects.toThrow(BadRequestException);
    });

    describe("path boundary matching (entry http://localhost:5175/sso/callback)", () => {
      it("rejects a same-prefix but different path segment (/sso/callback-evil)", async () => {
        await expect(
          service.authorize(USER_ID, "http://localhost:5175/sso/callback-evil")
        ).rejects.toThrow(BadRequestException);
      });

      it("allows a sub-path below the entry (/sso/callback/sub)", async () => {
        const result = await service.authorize(USER_ID, "http://localhost:5175/sso/callback/sub");
        expect(result.code).toMatch(/^[0-9a-f]{64}$/);
      });

      it("allows the exact entry path (/sso/callback)", async () => {
        const result = await service.authorize(USER_ID, "http://localhost:5175/sso/callback");
        expect(result.code).toMatch(/^[0-9a-f]{64}$/);
      });

      it("rejects an encoded-slash traversal (/sso/callback/%2f..%2fevil)", async () => {
        await expect(
          service.authorize(USER_ID, "http://localhost:5175/sso/callback/%2f..%2fevil")
        ).rejects.toThrow(BadRequestException);
      });

      it("rejects an uppercase encoded-slash traversal (%2F)", async () => {
        await expect(
          service.authorize(USER_ID, "http://localhost:5175/sso/callback/%2F..%2Fevil")
        ).rejects.toThrow(BadRequestException);
      });

      it("rejects an encoded-backslash variant (%5c)", async () => {
        await expect(
          service.authorize(USER_ID, "http://localhost:5175/sso/callback/%5c..%5cevil")
        ).rejects.toThrow(BadRequestException);
      });

      it("rejects encoded dot-segments (%2e%2e)", async () => {
        await expect(
          service.authorize(USER_ID, "http://localhost:5175/sso/callback/%2e%2e/evil")
        ).rejects.toThrow(BadRequestException);
      });

      it("still allows a normal sub-path after the encoding checks (/sso/callback/sub)", async () => {
        const result = await service.authorize(USER_ID, "http://localhost:5175/sso/callback/sub");
        expect(result.code).toMatch(/^[0-9a-f]{64}$/);
      });

      it("normalizes trailing slashes on whitelist entries", async () => {
        const slashy = new SsoService(
          makeConfig({
            SSO_JWT_SECRET: TEST_SECRET,
            JWT_SECRET: SESSION_SECRET,
            SSO_ALLOWED_REDIRECTS: "https://a.example.com/path/",
          }),
          jwtService,
          accountServiceMock as unknown as AccountService
        );
        const result = await slashy.authorize(USER_ID, "https://a.example.com/path");
        expect(result.code).toMatch(/^[0-9a-f]{64}$/);
        slashy.onModuleDestroy();
      });
    });
  });

  describe("exchange — one-time code consumption + redirect binding", () => {
    it("exchanges a fresh code for a token bound to the user's AA address", async () => {
      const { code } = await service.authorize(USER_ID, REDIRECT);
      const result = service.exchange(code, REDIRECT);

      expect(result.aaAddress).toBe(AA_ADDRESS);
      expect(result.expiresIn).toBe(SSO_TOKEN_TTL_SECONDS);

      const payload = jwtService.verify(result.token, {
        secret: TEST_SECRET,
        audience: SSO_TOKEN_AUDIENCE,
      });
      expect(payload.sub).toBe(USER_ID);
      expect(payload.aa).toBe(AA_ADDRESS);
    });

    it("consumes the code — a second exchange with the same code fails", async () => {
      const { code } = await service.authorize(USER_ID, REDIRECT);
      service.exchange(code, REDIRECT);
      expect(() => service.exchange(code, REDIRECT)).toThrow(UnauthorizedException);
    });

    it("rejects an unknown code", () => {
      expect(() => service.exchange("f".repeat(64), REDIRECT)).toThrow(UnauthorizedException);
    });

    it("rejects an expired code (TTL 60s) and keeps it consumed", async () => {
      jest.useFakeTimers();
      const { code } = await service.authorize(USER_ID, REDIRECT);
      jest.advanceTimersByTime(61_000);
      expect(() => service.exchange(code, REDIRECT)).toThrow(UnauthorizedException);
      // expired attempt consumed it too — still single-use even if the clock is rolled back
      expect(() => service.exchange(code, REDIRECT)).toThrow(UnauthorizedException);
    });

    it("rejects an exchange whose redirect_uri differs from the one bound at authorize", async () => {
      const { code } = await service.authorize(USER_ID, REDIRECT);
      expect(() => service.exchange(code, "https://myvote.example.com/other")).toThrow(
        UnauthorizedException
      );
      // the mismatch attempt burned the code — the correct redirect can no longer redeem it
      expect(() => service.exchange(code, REDIRECT)).toThrow(UnauthorizedException);
    });

    it("matches redirect_uri after URL normalization (host case-insensitive)", async () => {
      const { code } = await service.authorize(USER_ID, REDIRECT);
      const result = service.exchange(code, "https://MYVOTE.example.com/cb");
      expect(result.aaAddress).toBe(AA_ADDRESS);
    });

    it("returns one identical error for unknown, consumed, and expired codes (no oracle)", async () => {
      const grab = (fn: () => unknown): { status: number; message: string } => {
        try {
          fn();
        } catch (error) {
          const http = error as HttpException;
          return { status: http.getStatus(), message: http.message };
        }
        throw new Error("expected the exchange to throw");
      };

      // unknown
      const unknownErr = grab(() => service.exchange("a".repeat(64), REDIRECT));

      // consumed
      const { code: usedCode } = await service.authorize(USER_ID, REDIRECT);
      service.exchange(usedCode, REDIRECT);
      const consumedErr = grab(() => service.exchange(usedCode, REDIRECT));

      // expired
      jest.useFakeTimers();
      const { code: staleCode } = await service.authorize(USER_ID, REDIRECT);
      jest.advanceTimersByTime(61_000);
      const expiredErr = grab(() => service.exchange(staleCode, REDIRECT));
      jest.useRealTimers();

      expect(unknownErr).toEqual({ status: 401, message: "Invalid SSO code" });
      expect(consumedErr).toEqual(unknownErr);
      expect(expiredErr).toEqual(unknownErr);
    });
  });

  describe("verify — SSO token validation", () => {
    it("accepts a token minted by exchange", async () => {
      const { code } = await service.authorize(USER_ID, REDIRECT);
      const { token } = service.exchange(code, REDIRECT);
      expect(service.verify(token)).toEqual({ valid: true, aaAddress: AA_ADDRESS });
    });

    it("rejects a token with the wrong audience even when the secret matches", () => {
      const token = jwtService.sign(
        { sub: USER_ID, aa: AA_ADDRESS },
        { secret: TEST_SECRET, audience: "not-myvote", expiresIn: 600 }
      );
      expect(service.verify(token)).toEqual({ valid: false, aaAddress: null });
    });

    it("rejects a token signed with a different secret", () => {
      const token = jwtService.sign(
        { sub: USER_ID, aa: AA_ADDRESS },
        { secret: "other-secret", audience: SSO_TOKEN_AUDIENCE, expiresIn: 600 }
      );
      expect(service.verify(token)).toEqual({ valid: false, aaAddress: null });
    });

    it("rejects a token signed with a non-pinned algorithm (HS512), same secret and audience", () => {
      const token = jwtService.sign(
        { sub: USER_ID, aa: AA_ADDRESS },
        {
          secret: TEST_SECRET,
          algorithm: "HS512",
          audience: SSO_TOKEN_AUDIENCE,
          expiresIn: 600,
        }
      );
      expect(service.verify(token)).toEqual({ valid: false, aaAddress: null });
    });

    it("rejects an expired token", async () => {
      jest.useFakeTimers();
      const { code } = await service.authorize(USER_ID, REDIRECT);
      const { token } = service.exchange(code, REDIRECT);
      jest.advanceTimersByTime((SSO_TOKEN_TTL_SECONDS + 1) * 1000);
      expect(service.verify(token)).toEqual({ valid: false, aaAddress: null });
    });

    it("rejects garbage input", () => {
      expect(service.verify("not-a-jwt")).toEqual({ valid: false, aaAddress: null });
    });
  });
});

describe("JwtStrategy — SSO token exclusion on the cos72 session path", () => {
  function makeStrategy(): JwtStrategy {
    return new JwtStrategy(makeConfig({ JWT_SECRET: SESSION_SECRET }));
  }

  it("rejects a payload carrying the SSO audience", async () => {
    await expect(
      makeStrategy().validate({ sub: USER_ID, aud: SSO_TOKEN_AUDIENCE })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a payload whose audience array contains the SSO audience", async () => {
    await expect(
      makeStrategy().validate({ sub: USER_ID, aud: ["other", SSO_TOKEN_AUDIENCE] })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("accepts a legacy session payload without an aud claim", async () => {
    await expect(
      makeStrategy().validate({ sub: USER_ID, email: "u@example.com", username: "u" })
    ).resolves.toEqual({ sub: USER_ID, email: "u@example.com", username: "u" });
  });
});

describe("SsoRateLimit guard", () => {
  beforeEach(() => {
    __resetSsoRateLimit();
  });

  function makeContext(ip: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ip }),
        getResponse: () => ({ header: jest.fn() }),
      }),
    } as any;
  }

  it("allows up to `max` hits then throws 429 for the same IP", () => {
    const Guard = SsoRateLimit("test-bucket", 3, 60_000);
    const guard = new Guard();

    expect(guard.canActivate(makeContext("1.2.3.4"))).toBe(true);
    expect(guard.canActivate(makeContext("1.2.3.4"))).toBe(true);
    expect(guard.canActivate(makeContext("1.2.3.4"))).toBe(true);

    let caught: unknown;
    try {
      guard.canActivate(makeContext("1.2.3.4"));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(429);
  });

  it("tracks IPs independently", () => {
    const Guard = SsoRateLimit("test-bucket-2", 1, 60_000);
    const guard = new Guard();

    expect(guard.canActivate(makeContext("1.1.1.1"))).toBe(true);
    expect(guard.canActivate(makeContext("2.2.2.2"))).toBe(true);
    expect(() => guard.canActivate(makeContext("1.1.1.1"))).toThrow(HttpException);
  });

  it("tracks buckets independently for the same IP", () => {
    const ExchangeGuard = SsoRateLimit("bucket-a", 1, 60_000);
    const VerifyGuard = SsoRateLimit("bucket-b", 1, 60_000);

    expect(new ExchangeGuard().canActivate(makeContext("3.3.3.3"))).toBe(true);
    expect(new VerifyGuard().canActivate(makeContext("3.3.3.3"))).toBe(true);
    expect(() => new ExchangeGuard().canActivate(makeContext("3.3.3.3"))).toThrow(HttpException);
  });

  it("frees the budget once the window slides past", () => {
    jest.useFakeTimers();
    try {
      const Guard = SsoRateLimit("test-bucket-3", 1, 60_000);
      const guard = new Guard();

      expect(guard.canActivate(makeContext("4.4.4.4"))).toBe(true);
      expect(() => guard.canActivate(makeContext("4.4.4.4"))).toThrow(HttpException);

      jest.advanceTimersByTime(61_000);
      expect(guard.canActivate(makeContext("4.4.4.4"))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
