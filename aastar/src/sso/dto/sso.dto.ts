import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches, MaxLength } from "class-validator";

export class SsoAuthorizeDto {
  @ApiProperty({
    example: "https://myvote.example.com/sso/callback",
    description:
      "Absolute URL MyVote will receive the one-time code on. Must match the SSO_ALLOWED_REDIRECTS whitelist (fail-closed).",
  })
  @IsString()
  @MaxLength(2048)
  redirect_uri: string;
}

export class SsoExchangeDto {
  @ApiProperty({
    example: "a".repeat(64),
    description:
      "One-time code obtained from POST /sso/authorize (32-byte hex, TTL 60s, single use)",
  })
  @IsString()
  @Length(64, 64)
  @Matches(/^[0-9a-f]{64}$/, { message: "code must be 64 lowercase hex characters" })
  code: string;
}
