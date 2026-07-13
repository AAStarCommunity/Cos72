import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsEthereumAddress, Matches } from "class-validator";

/**
 * Phase-1 of a generic gasless UserOp (the `cosSend` write path — see the
 * frontend `lib/sdk/cosTx.ts`). Unlike the transfer DTO this is a raw contract
 * call: `{to, data, value}` with no `amount`/`tokenAddress` monetary framing.
 * The account is resolved server-side from the JWT — never trusted from the body.
 */
export class PrepareUserOpDto {
  @ApiProperty({ description: "Target contract / recipient" })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: "Call data (0x-prefixed hex; 0x for a bare value send)" })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]*$/, { message: "data must be 0x-prefixed hex" })
  data: string;

  @ApiProperty({ required: false, description: "Native value in wei (decimal string; default 0)" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/, { message: "value must be a decimal wei string" })
  value?: string;

  @ApiProperty({
    required: false,
    description:
      "Tier-2/3 device-passkey path: skip the KMS owner ceremony (frontend sets it when " +
      "the account resolves to tier>=2). The SDK rejects it for Tier-1.",
  })
  @IsOptional()
  @IsBoolean()
  useWebAuthnPasskey?: boolean;

  @ApiProperty({
    required: false,
    description: "Sponsor gas (default true — Cos72 is gasless-only)",
  })
  @IsOptional()
  @IsBoolean()
  usePaymaster?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymasterAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymasterData?: string;
}
