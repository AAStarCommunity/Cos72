/* eslint-disable @typescript-eslint/no-explicit-any */

import { ethers } from "ethers";

import { SimpleAccountAPI } from "./SimpleAccountAPI";
import { PaymasterAPI } from "./PaymasterAPI";
import { StackupPayMasterAPI } from "./paymaster/StackupPayMasterAPI";
import { PimlicoPayMasterAPI } from "./paymaster/PimlicoPayMasterAPI";
import { AAStarPayMasterAPI } from "./paymaster/AAStarPayMasterAPI";
import { BiconomyPayMasterAPI } from "./paymaster/BiconomyPayMasterAPI";
import { BundlerClient } from "./BundlerClient";

export type Provider = "stackup" | "pimlico" | "aastar" | "biconomy";

export interface BundlerConfig {
  provider: Provider;
  config: {
    url: string;
  };
}

export interface PaymasterConfig {
  provider: Provider;
  config: {
    url: string;
  };
}

export interface AAWalletConfig {
  entryPointAddress: string;
  factoryAddress: string;
}

export interface SmartAccountParams {
  rpc: string;
  bundler: BundlerConfig;
  paymaster: PaymasterConfig;
  signer: ethers.Wallet;
  aaConfig?: AAWalletConfig;
}
const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";

export class AAStarClient {
  bundler: BundlerConfig;
  paymaster: PaymasterConfig;
  aaWallet: SimpleAccountAPI | null;
  aaConfig: AAWalletConfig;
  rpc: string;
  signer: ethers.Wallet;
  provider: ethers.providers.JsonRpcProvider;
  bundlerClient: BundlerClient | null;
  constructor(params: SmartAccountParams) {
    this.bundler = params.bundler;
    this.paymaster = params.paymaster;
    this.aaWallet = null;
    this.bundlerClient = null;
    this.rpc = params.rpc;
    this.signer = params.signer;
    this.provider = new ethers.providers.JsonRpcProvider(this.rpc);
    this.aaConfig = {
      entryPointAddress: params.aaConfig?.entryPointAddress
        ? params.aaConfig?.entryPointAddress
        : entryPointAddress,
      factoryAddress: params.aaConfig?.factoryAddress
        ? params.aaConfig?.factoryAddress
        : factoryAddress,
    };
  }

  async sendUserOperation(callTo: string[], callData: string[]) {
    if (!this.aaWallet) {
      this.aaWallet = new SimpleAccountAPI({
        provider: new ethers.providers.JsonRpcProvider(this.rpc),
        entryPointAddress,
        owner: this.signer,
        factoryAddress,
        paymasterAPI: this.buildPayMaster(),
      });
    }
    if (!this.bundlerClient) {
      this.bundlerClient = await this.buildBundlerClient();
    }
    const address = await this.aaWallet.getCounterFactualAddress();
    const op = await this.aaWallet.createSignedUserOp({
      target: address,
      data: [callTo, callData],
    });
    const userOpHash = await this.bundlerClient.sendUserOpToBundler(op);
    const transactionHash = await this.aaWallet.getUserOpReceipt(userOpHash);
    return {
      aaAccountAddress: address,
      userOpHash,
      transactionHash,
    };
  }

  private buildPayMaster() {
    let paymasterAPI: PaymasterAPI | null = null;
    switch (this.paymaster.provider) {
      case "stackup": {
        paymasterAPI = new StackupPayMasterAPI(
          this.paymaster.config.url,
          this.aaConfig.entryPointAddress
        );
        break;
      }
      case "pimlico": {
        paymasterAPI = new PimlicoPayMasterAPI(
          this.paymaster.config.url,
          this.aaConfig.entryPointAddress
        );
        break;
      }
      case "aastar": {
        paymasterAPI = new AAStarPayMasterAPI(
          this.paymaster.config.url,
          this.aaConfig.entryPointAddress
        );
        break;
      }
      case "biconomy": {
        paymasterAPI = new BiconomyPayMasterAPI(
          this.paymaster.config.url,
          this.aaConfig.entryPointAddress
        );
        break;
      }
    }
    return paymasterAPI;
  }
  
  private async buildBundlerClient() {
    const chainId = await this.provider.getNetwork().then((net) => net.chainId);
    const client = new BundlerClient(
      this.bundler.config.url,
      this.aaConfig.entryPointAddress,
      chainId
    );
    return client;
  }

  public getAAWallet() {
    return this.aaWallet;
  }
}
