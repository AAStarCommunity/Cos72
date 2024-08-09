/* eslint-disable @typescript-eslint/no-explicit-any */

import { ethers } from "ethers";

import { ENTRYPOINT_ADDRESS_V07, createSmartAccountClient } from "permissionless";
import { signerToSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { Presets, Client } from "userop";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export type Provider =  "stackup" | "pimlico" | "zerodev";

export interface BundlerConfig {
    provider: Provider;
    config : {
        url: string 
    }
}

export interface PaymasterConfig {
    provider: Provider;
    config : {
        url: string 
    }
}
export class StackupBundler {

}
export interface SmartAccountParams {
    bundler: BundlerConfig, 
    paymaster: PaymasterConfig
}
export class SmartAccount  {
    bundler: BundlerConfig
    paymaster: PaymasterConfig
    constructor(params: SmartAccountParams) {
        this.bundler = params.bundler;
        this.paymaster = params.paymaster;
    }

    async sendUserOperation(signer: ethers.Wallet , callTo: string[], callData: string []) {
        if (this.bundler.provider === "stackup") {
            const paymasterContext = { type: "payg" };
            const builder = await Presets.Builder.SimpleAccount.init(signer, this.bundler.config.url, {
                paymasterMiddleware: Presets.Middleware.verifyingPaymaster(
                    this.paymaster.config.url,
                    paymasterContext
                )
            });
            const client = await Client.init(this.bundler.config.url);
            const res = await client.sendUserOperation(builder.executeBatch(callTo, callData));
            return res;
        }
        if (this.bundler.provider === "pimlico") {
            const publicClient = createPublicClient({
                transport: http("https://rpc.ankr.com/eth_sepolia"),
            })
            const paymasterClient = createPimlicoPaymasterClient({
                transport: http(this.paymaster.config.url),
                entryPoint: ENTRYPOINT_ADDRESS_V07,
            })
            const account = await signerToSafeSmartAccount(publicClient, {
                signer: privateKeyToAccount(signer.privateKey as any),
                entryPoint: ENTRYPOINT_ADDRESS_V07, // global entrypoint
                safeVersion: "1.4.1",
            })
            const bundlerClient = createPimlicoBundlerClient({
                transport: http(this.bundler.config.url),
                entryPoint: ENTRYPOINT_ADDRESS_V07,
            })
            const smartAccountClient = createSmartAccountClient({
                account,
                entryPoint: ENTRYPOINT_ADDRESS_V07,
                chain: sepolia,
                bundlerTransport: http(this.bundler.config.url),
                middleware: {
                    gasPrice: async () => {
                        return (await bundlerClient.getUserOperationGasPrice()).fast
                    },
                    sponsorUserOperation: paymasterClient.sponsorUserOperation,
                },
            })
           
            return {
                userOpHash: "0x",
                wait: async () => {
                    const txHash = await smartAccountClient.sendTransaction(
                        {
                            to: callTo[0] as any,
                            value: 0n,
                            data: callData[0] as any
                        }
                    )
                    return {
                        transactionHash: txHash
                    };
                }
            }
        }
   
    }

}