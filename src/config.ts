import { ethers } from "ethers";
import { BundlerConfig, PaymasterConfig } from "./sdk/AAStarClient";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const networkIds = {
  ETH_SEPOLIA: 11155111,
  OP_SEPOLIA: 11155420,
  ARB_SEPOLIA: 421614,
} as const;
export type NetworkId = 11155111 | 11155420 | 421614;
export interface INetwork {
  name: string;
  chainId: number;
  rpc: string;
  blockExplorerURL: null | string;
  contracts: {
    USDT: string;
    NFT: string;
  };
  bundler: BundlerConfig[];
  paymaster: PaymasterConfig[];
}
export const NetworkdConfig: { [K in NetworkId]: INetwork } = {
  [networkIds.ETH_SEPOLIA]: {
    name: "Sepolia",
    rpc: "https://public.stackup.sh/api/v1/node/ethereum-sepolia",
    chainId: networkIds.ETH_SEPOLIA,
    blockExplorerURL: "https://sepolia.etherscan.io",
    contracts: {
      USDT: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06",
      NFT: "0xCEf599508abd274bab8F0D9D9149d9ceeD9a2A07"
    },
    bundler: [
      {
        provider: "stackup",
        config: {
          url: "https://public.stackup.sh/api/v1/node/ethereum-sepolia",
        },
      },
      {
        provider: "pimlico",
        config: {
          url: "https://api.pimlico.io/v2/11155111/rpc?apikey=7dc438e7-8de7-47f0-9d71-3372e57694ca",
        },
      },
      {
        provider: "biconomy",
        config: {
          url: "https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
        },
      },
    ],
    paymaster: [
      {
        provider: "stackup",
        config: {
          url: "https://api.stackup.sh/v1/paymaster/e008121e92221cb49073b5bca65d434fbeb2162e73f42a9e3ea01d00b606fcba",
          option: {
            type: "payg",
          },
        },
      },
      {
        provider: "pimlico",
        config: {
          url: "https://api.pimlico.io/v2/11155111/rpc?apikey=7dc438e7-8de7-47f0-9d71-3372e57694ca",
        },
      },
      {
        provider: "biconomy",
        config: {
          url: "https://paymaster.biconomy.io/api/v1/11155111/sbA6OmcPO.016e1abd-0db6-4909-a806-175f617f1cb9",
          option: {
            mode: "SPONSORED",
            calculateGasLimits: true,
            expiryDuration: 300,
            sponsorshipInfo: {
              webhookData: {},
              smartAccountInfo: {
                name: "BICONOMY",
                version: "2.0.0",
              },
            },
          },
        },
      },
      {
        provider: "aastar",
        config: {
          url: "https://paymaster.aastar.io/api/v1/paymaster/ethereum-sepolia?apiKey=fe6017a4-9e13-4750-ae69-a7568f633eb5",
          option: {
            strategy_code: "a__d7MwJ",
            version: "v0.6",
          },
        },
      },
    ],
  },
  [networkIds.OP_SEPOLIA]: {
    name: "OP Sepolia Testnet",
    rpc: "https://public.stackup.sh/api/v1/node/optimism-sepolia",
    chainId: networkIds.OP_SEPOLIA,
    blockExplorerURL: "https://sepolia-optimism.etherscan.io",
    contracts: {
      USDT: "0x1927E2D716D7259d06006bFaF3dBFA22A12d6945",
      NFT: "0xcef599508abd274bab8f0d9d9149d9ceed9a2a07"
    },
    bundler: [
      {
        provider: "stackup",
        config: {
          url: "https://public.stackup.sh/api/v1/node/optimism-sepolia",
        },
      },
    ],
    paymaster: [
      {
        provider: "stackup",
        config: {
          url: "https://api.stackup.sh/v1/paymaster/5309e1878a24d01f3998beb56b2357443f72d127ee224eab072bd2378168da01",
          option: {
            type: "payg",
          },
        },
      },
    ],
  },
  [networkIds.ARB_SEPOLIA]: {
    name: "Arbitrum Sepolia",
    rpc: "https://public.stackup.sh/api/v1/node/arbitrum-sepolia",
    chainId: networkIds.ARB_SEPOLIA,
    blockExplorerURL: "https://sepolia-explorer.arbitrum.io",
    contracts: {
      USDT: "0x1927E2D716D7259d06006bFaF3dBFA22A12d6945",
      NFT: ethers.constants.AddressZero
    },
    bundler: [
      {
        provider: "stackup",
        config: {
          url: "https://public.stackup.sh/api/v1/node/arbitrum-sepolia",
        },
      },
    ],
    paymaster: [
      {
        provider: "stackup",
        config: {
          url: "https://api.stackup.sh/v1/paymaster/5309e1878a24d01f3998beb56b2357443f72d127ee224eab072bd2378168da01",
          option: {
            type: "payg",
          },
        },
      },
    ],
  },
};
