import { Body, Controller, Get, Headers, HttpCode, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SsoAuthorizeDto, SsoExchangeDto } from "./dto/sso.dto";
import { SsoRateLimit } from "./guards/sso-rate-limit.guard";
import { SsoService } from "./sso.service";

// exchange/verify are public (MyVote calls them cross-origin before it has any session),
// so both get a per-IP sliding-window limit: 20 req/min per bucket.
const SSO_RATE_MAX = 20;
const SSO_RATE_WINDOW_MS = 60_000;

@ApiTags("sso")
@Controller("sso")
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Post("authorize")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: "Mint a one-time SSO code for the logged-in user (MyVote handoff)" })
  @ApiResponse({ status: 200, description: "{ code, redirectUri } — code TTL 60s, single use" })
  @ApiResponse({
    status: 400,
    description: "redirect_uri not whitelisted, or user has no AirAccount",
  })
  async authorize(@Request() req, @Body() dto: SsoAuthorizeDto) {
    // userId comes from the cos72 JWT — never from the request body.
    return this.ssoService.authorize(req.user.sub, dto.redirect_uri);
  }

  @Post("exchange")
  @UseGuards(SsoRateLimit("exchange", SSO_RATE_MAX, SSO_RATE_WINDOW_MS))
  @HttpCode(200)
  @ApiOperation({
    summary: "Swap a one-time SSO code for a short-lived SSO session token (public)",
  })
  @ApiResponse({
    status: 200,
    description: "{ token, aaAddress, expiresIn } — JWT audience 'myvote', TTL 10min",
  })
  @ApiResponse({
    status: 401,
    description: "Code invalid / expired / already consumed / redirect_uri mismatch (unified)",
  })
  async exchange(@Body() dto: SsoExchangeDto) {
    return this.ssoService.exchange(dto.code, dto.redirect_uri);
  }

  @Get("verify")
  @UseGuards(SsoRateLimit("verify", SSO_RATE_MAX, SSO_RATE_WINDOW_MS))
  @ApiOperation({ summary: "Validate an SSO session token (public, for MyVote backend/edge)" })
  @ApiResponse({ status: 200, description: "{ valid, aaAddress } — never throws on a bad token" })
  async verify(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    if (!token) {
      return { valid: false, aaAddress: null };
    }
    return this.ssoService.verify(token);
  }
}
