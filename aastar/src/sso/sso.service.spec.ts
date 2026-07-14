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
import { SsoRateLimit, __resetSsoRateLimit } from "./guards/sso-rate-limit.guard";
import { SSO_TOKEN_AUDIENCE, SSO_TOKEN_TTL_SECONDS, SsoService } from "./sso.service";

const TEST_SECRET = "test-sso-secret";
const ALLOWED = "https://myvote.example.com,http://localhost:5175/sso/callback";
const AA_ADDRESS = "0x1111111111111111111111111111111111111111";
const USER_ID = "user-1";

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
          useValue: makeConfig({ SSO_JWT_SECRET: TEST_SECRET, SSO_ALLOWED_REDIRECTS: ALLOWED }),
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

  describe("authorize — redirect whitelist (fail-closed)", () => {
    it("rejects every redirect when SSO_ALLOWED_REDIRECTS is unset", async () => {
      const closed = new SsoService(
        makeConfig({ SSO_JWT_SECRET: TEST_SECRET }),
        jwtService,
        accountServiceMock as unknown as AccountService
      );
      await expect(
        closed.authorize(USER_ID, "https://myvote.example.com/sso/callback")
      ).rejects.toThrow(BadRequestException);
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
      await expect(
        service.authorize(USER_ID, "https://myvote.example.com/sso/callback")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("exchange — one-time code consumption", () => {
    it("exchanges a fresh code for a token bound to the user's AA address", async () => {
      const { code } = await service.authorize(USER_ID, "https://myvote.example.com/cb");
      const result = service.exchange(code);

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
      const { code } = await service.authorize(USER_ID, "https://myvote.example.com/cb");
      service.exchange(code);
      expect(() => service.exchange(code)).toThrow(UnauthorizedException);
    });

    it("rejects an unknown code", () => {
      expect(() => service.exchange("f".repeat(64))).toThrow(UnauthorizedException);
    });

    it("rejects an expired code (TTL 60s) and keeps it consumed", async () => {
      jest.useFakeTimers();
      const { code } = await service.authorize(USER_ID, "https://myvote.example.com/cb");
      jest.advanceTimersByTime(61_000);
      expect(() => service.exchange(code)).toThrow(UnauthorizedException);
      // expired attempt consumed it too — still single-use even if the clock is rolled back
      expect(() => service.exchange(code)).toThrow(UnauthorizedException);
    });
  });

  describe("verify — SSO token validation", () => {
    it("accepts a token minted by exchange", async () => {
      const { code } = await service.authorize(USER_ID, "https://myvote.example.com/cb");
      const { token } = service.exchange(code);
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

    it("rejects an expired token", async () => {
      jest.useFakeTimers();
      const { code } = await service.authorize(USER_ID, "https://myvote.example.com/cb");
      const { token } = service.exchange(code);
      jest.advanceTimersByTime((SSO_TOKEN_TTL_SECONDS + 1) * 1000);
      expect(service.verify(token)).toEqual({ valid: false, aaAddress: null });
    });

    it("rejects garbage input", () => {
      expect(service.verify("not-a-jwt")).toEqual({ valid: false, aaAddress: null });
    });
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
