import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsObject, IsOptional, Matches } from "class-validator";
import { DeviceWebAuthnDto } from "../../transfer/dto/submit-transfer.dto";

/**
 * Phase-3 of a generic gasless UserOp. Same two mutually-exclusive completion
 * paths as a transfer (the SDK decides by tier):
 *  - Tier-1 (KMS owner ceremony): `challengeId` + `credential`.
 *  - Tier-2/3 (WebAuthn passkey): `deviceWebAuthn` (challenge = userOpHash).
 * Plus an optional Tier-3 `guardianSignature`. `opId` is the prepared handle.
 */
export class SubmitUserOpDto {
  @ApiProperty({ description: "Opaque handle returned by /userop/prepare" })
  @IsString()
  opId: string;

  @ApiProperty({ required: false, description: "Tier-1 KMS ceremony ChallengeId" })
  @IsOptional()
  @IsString()
  challengeId?: string;

  @ApiProperty({ required: false, description: "Tier-1 KMS ceremony WebAuthn credential" })
  @IsOptional()
  @IsObject()
  credential?: unknown;

  @ApiProperty({ required: false, type: DeviceWebAuthnDto, description: "Tier-2/3 passkey assertion" })
  @IsOptional()
  @IsObject()
  deviceWebAuthn?: DeviceWebAuthnDto;

  @ApiProperty({ required: false, description: "Tier-3 guardian co-signature (hex) over userOpHash" })
  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]+$/, { message: "guardianSignature must be a 0x-prefixed hex string" })
  guardianSignature?: string;
}
