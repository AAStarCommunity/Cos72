import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AirAccountServerClient as YAAAServerClient,
  DvtPendingConfirmationError,
} from "@aastar/sdk/kms";
import { getCanonicalAddresses } from "@aastar/sdk/core";
import { formatEther } from "viem";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";
import { PrepareUserOpDto } from "./dto/prepare-userop.dto";
import { SubmitUserOpDto } from "./dto/submit-userop.dto";

/**
 * Generic gasless UserOp — the backend half of `cosSend` (frontend
 * `lib/sdk/cosTx.ts`). A thin passthrough to the same shared
 * `YAAA_SERVER_CLIENT.transfers.*` the transfer flow uses: the SDK's transfer
 * path is already a raw `AirAccount.execute(to, value, data)` call when no token
 * is given, so an arbitrary contract call reuses it verbatim. Tier logic /
 * KMS / BLS / guardian / bundler all live in the SDK — this only maps the DTO
 * and drops the transfer-specific bits (token auto-encode, address book).
 *
 * ALL tiers are supported (same two ceremony paths as transfer): Tier-1 KMS
 * owner ceremony (`challengeId`+`credential`) and Tier-2/3 WebAuthn passkey
 * (`deviceWebAuthn`), plus Tier-3 guardian co-sign. The account is resolved
 * from the JWT `userId` inside the SDK — never from the request body.
 */
@Injectable()
export class UserOpService {
  private readonly logger = new Logger(UserOpService.name);

  constructor(
    @Inject(YAAA_SERVER_CLIENT) private client: YAAAServerClient,
    private configService: ConfigService
  ) {}

  async prepare(userId: string, dto: PrepareUserOpDto) {
    // cosSend sends `value` in wei; the SDK's `amount` is an ETH-string it
    // parseEther()s back to wei — convert so the round-trip is exact.
    const amount = dto.value ? formatEther(BigInt(dto.value)) : "0";
    const paymasterTokenAddress = this.resolvePaymasterToken(dto.paymasterAddress);
    this.logger.log(`userop.prepare: userId=${userId} to=${dto.to} value=${dto.value ?? "0"}`);
    const prep = await this.client.transfers.prepareTransfer(userId, {
      to: dto.to,
      amount,
      data: dto.data,
      usePaymaster: dto.usePaymaster !== false, // gasless-only: default on
      paymasterAddress: dto.paymasterAddress,
      paymasterData: dto.paymasterData,
      paymasterTokenAddress,
      useAirAccountTiering: true,
      useWebAuthnPasskey: dto.useWebAuthnPasskey === true,
    });
    return {
      opId: prep.transferId,
      userOpHash: prep.userOpHash,
      challengeId: prep.challengeId,
      publicKeyOptions: prep.publicKeyOptions,
      tier: prep.tier,
      requiredSigs: prep.requiredSigs,
    };
  }

  async submit(userId: string, dto: SubmitUserOpDto) {
    const guardianSigner = dto.guardianSignature
      ? { signMessage: async () => dto.guardianSignature as string }
      : undefined;
    this.logger.log(`userop.submit: userId=${userId} opId=${dto.opId}`);
    try {
      if (dto.deviceWebAuthn) {
        return await this.client.transfers.submitPreparedTransfer(userId, {
          transferId: dto.opId,
          deviceWebAuthn: {
            authenticatorData: dto.deviceWebAuthn.authenticatorData as `0x${string}`,
            clientDataJSON: dto.deviceWebAuthn.clientDataJSON,
            signature: dto.deviceWebAuthn.signature as `0x${string}`,
          },
          ...(guardianSigner ? { guardianSigner } : {}),
        });
      }
      return await this.client.transfers.submitPreparedTransfer(userId, {
        transferId: dto.opId,
        webAuthnAssertion: { ChallengeId: dto.challengeId, Credential: dto.credential },
        ...(guardianSigner ? { guardianSigner } : {}),
      });
    } catch (err: any) {
      // Scheme-2: DVT withheld its co-sig pending out-of-band approval — return a
      // structured pending payload so the client drives the confirmation + resubmits.
      if (err instanceof DvtPendingConfirmationError) {
        return {
          success: false,
          pendingConfirmation: true,
          userOpHash: err.userOpHash,
          nodeEndpoint: err.nodeEndpoint,
        };
      }
      this.logger.error(`userop.submit FAILED: ${err?.message ?? err}`, err?.stack);
      throw err;
    }
  }

  /** Poll target for the client (cosSend polls until `transactionHash` appears). */
  async getStatus(userId: string, id: string) {
    return this.client.transfers.getTransferStatus(userId, id);
  }

  /** PMv4 gas-token: same canonical resolution as TransferService (undefined unless PMv4). */
  private resolvePaymasterToken(paymasterAddress?: string): string | undefined {
    const canonical = getCanonicalAddresses(this.configService.get<number>("chainId") ?? 11155111);
    return canonical && paymasterAddress?.toLowerCase() === canonical.paymasterV4?.toLowerCase()
      ? canonical.aPNTs
      : undefined;
  }
}
