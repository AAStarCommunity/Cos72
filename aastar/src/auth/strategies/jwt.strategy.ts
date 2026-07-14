import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SSO_TOKEN_AUDIENCE } from "../../sso/sso.constants";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>("JWT_SECRET");

    if (!jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      // Pin the algorithm — never trust the token header's alg claim.
      algorithms: ["HS256"],
    });
  }

  async validate(payload: any) {
    // Reject MyVote SSO tokens (audience "myvote") on the cos72 session path. This is
    // defense-in-depth: SSO tokens are signed with a distinct SSO_JWT_SECRET (enforced
    // != JWT_SECRET at boot), so their signature already fails here — this keeps the
    // token-domain boundary even under secret misconfiguration. Deliberately an
    // audience-EXCLUSION rather than a required audience: existing cos72 session tokens
    // carry no `aud` claim, and requiring one would invalidate every live session.
    const aud = payload?.aud;
    const audiences: unknown[] = Array.isArray(aud) ? aud : aud !== undefined ? [aud] : [];
    if (audiences.includes(SSO_TOKEN_AUDIENCE)) {
      throw new UnauthorizedException("SSO session tokens cannot be used for cos72 APIs");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
