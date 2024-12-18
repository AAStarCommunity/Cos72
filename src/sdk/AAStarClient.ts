/* eslint-disable @typescript-eslint/no-explicit-any */

import { ethers } from "ethers";

import { SimpleAccountAPI } from "./account/SimpleAccountAPI";
import { PaymasterAPI } from "./PaymasterAPI";
import { StackupPayMasterAPI } from "./paymaster/StackupPayMasterAPI";
import { PimlicoPayMasterAPI } from "./paymaster/PimlicoPayMasterAPI";
import { AAStarPayMasterAPI } from "./paymaster/AAStarPayMasterAPI";
import { BiconomyPayMasterAPI } from "./paymaster/BiconomyPayMasterAPI";
import { BundlerClient } from "./BundlerClient";
import { AirAccountAPI } from "./account/AirAccountAPI";

export type Provider = "stackup" | "pimlico" | "aastar" | "biconomy";
export type AAProvider = "SimpleAccount" | "AirAccount";
export interface BundlerConfig {
  provider: Provider;
  config: {
    url: string;
    option? : any;
   
  };
}

export interface PaymasterConfig {
  provider: Provider;
  config: {
    url: string;
    option? : any;
    entryPoint?: string;
  };
}

export interface AAWalletConfig {
  entryPointAddress?: string;
  factoryAddress?: string;
  provider?: AAProvider
}

export interface SmartAccountParams {
  rpc: string;
  bundler: BundlerConfig;
  paymaster: PaymasterConfig;
  signer?: ethers.Wallet;
  aaConfig?: AAWalletConfig;
  network?: string;
}
export const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";
const getWallet = () => {
  const signingKey = localStorage.getItem("__aastar_signingKey");
  let signer: ethers.Wallet | null = null;
  if (signingKey) {
    signer = new ethers.Wallet(signingKey);
  } else {
    signer = ethers.Wallet.createRandom();
    localStorage.setItem("__aastar_signingKey", signer.privateKey);
  }
  return signer;
};
export class AAStarClient {
  bundler: BundlerConfig;
  paymaster: PaymasterConfig;
  aaWallet: SimpleAccountAPI | AirAccountAPI | null;
  aaConfig: AAWalletConfig;
  rpc: string;
  signer: any;
  provider: ethers.providers.JsonRpcProvider;
  bundlerClient: BundlerClient | null;
  
  constructor(params: SmartAccountParams) {
    this.bundler = params.bundler;
    this.paymaster = params.paymaster;
    this.aaWallet = null;
    this.bundlerClient = null;
    this.rpc = params.rpc;
    if (params.signer) {
      this.signer = params.signer
    }
    else {
      this.signer = getWallet();
    }
    this.provider = new ethers.providers.JsonRpcProvider(this.rpc);
    this.aaConfig = {
      entryPointAddress: params.aaConfig?.entryPointAddress
        ? params.aaConfig?.entryPointAddress
        : entryPointAddress,
      factoryAddress: params.aaConfig?.factoryAddress
        ? params.aaConfig?.factoryAddress
        : factoryAddress,
      provider: params.aaConfig?.provider ? params.aaConfig?.provider  : "AirAccount"
    };
    if (!this.aaWallet) {
      if (this.aaConfig.provider === "SimpleAccount") {
        this.aaWallet = new SimpleAccountAPI({
          provider: new ethers.providers.JsonRpcProvider(this.rpc),
          entryPointAddress,
          owner: this.signer,
          factoryAddress,
          paymasterAPI: this.buildPayMaster(),
        });
      }
      else {
        this.aaWallet = new AirAccountAPI({
          provider: new ethers.providers.JsonRpcProvider(this.rpc),
          entryPointAddress,
          factoryAddress,
          paymasterAPI: this.buildPayMaster(),
        
        });
      }
    }
  }

  async sendUserOperation(callTo: string[], callData: string[], value? : ethers.BigNumber) {
    if (!this.aaWallet) {
      if (this.aaConfig.provider === "SimpleAccount") {
        this.aaWallet = new SimpleAccountAPI({
          provider: new ethers.providers.JsonRpcProvider(this.rpc),
          entryPointAddress,
          owner: this.signer,
          factoryAddress,
          paymasterAPI: this.buildPayMaster(),
        });
      }
      else {
        this.aaWallet = new AirAccountAPI({
          provider: new ethers.providers.JsonRpcProvider(this.rpc),
          entryPointAddress,
          factoryAddress,
          paymasterAPI: this.buildPayMaster(),
        
        });
      }
    }
    if (!this.bundlerClient) {
      this.bundlerClient = await this.buildBundlerClient();
    }

    const address = await this.aaWallet.getCounterFactualAddress();
    const params: any = {
      target: address,
      data: [callTo, callData],
    }
    if (value) {
      params.value = value;
      params.target = callTo[0]
      params.data = callData[0];
    }
    const op = await this.aaWallet.createSignedUserOp(params);
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
          this.paymaster
        );
        break;
      }
      case "pimlico": {
        paymasterAPI = new PimlicoPayMasterAPI(this.paymaster);
        break;
      }
      case "aastar": {
        paymasterAPI = new AAStarPayMasterAPI(this.paymaster);
        break;
      }
      case "biconomy": {
        paymasterAPI = new BiconomyPayMasterAPI(this.paymaster);
        break;
      }
    }
    return paymasterAPI;
  }
  
  private async buildBundlerClient() {
    const chainId = await this.provider.getNetwork().then((net) => net.chainId);
    const client = new BundlerClient(
      this.bundler.config.url,
      this.aaConfig.entryPointAddress as any,
      chainId
    );
    return client;
  }

  public getAAWallet() {
    return this.aaWallet;
  }
}
