import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccountModule } from "../account/account.module";
import { SsoController } from "./sso.controller";
import { SsoService } from "./sso.service";

/**
 * MyVote SSO channel (MV-1, cos72 half): one-time code issuance + code→token exchange +
 * token verification. JwtModule is registered bare on purpose — the SSO token uses its own
 * secret (SSO_JWT_SECRET) and options passed explicitly per sign/verify call, never the
 * cos72 session JWT defaults.
 */
@Module({
  imports: [JwtModule.register({}), AccountModule],
  controllers: [SsoController],
  providers: [SsoService],
})
export class SsoModule {}
