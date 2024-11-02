import { ethers } from "ethers";
import { BundlerConfig, PaymasterConfig } from "./sdk/AAStarClient";

import { PinataSDK } from "pinata"

/* eslint-disable @typescript-eslint/no-explicit-any */
export const networkIds = {
  ETH_SEPOLIA: 11155111,
  OP_SEPOLIA: 11155420,
  OP_MAINNET: 10,
  ARB_SEPOLIA: 421614,
  BASE_SEPOLIA: 84532
} as const;
export type NetworkId = 11155111 | 11155420 | 421614 | 84532 | 10
export interface INetwork {
  name: string;
  chainId: number;
  rpc: string;
  blockExplorerURL: null | string;
  contracts: {
    USDT: string;
    NFT: string;
    CommunityManager: string;
    CommunityV1: string;
    CommunityStoreV1: string;
    CommunityStoreV2: string;
    EventManager: string;
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
      NFT: "0xCEf599508abd274bab8F0D9D9149d9ceeD9a2A07",
      CommunityV1: ethers.constants.AddressZero,
      CommunityStoreV1: ethers.constants.AddressZero,
      CommunityStoreV2: ethers.constants.AddressZero,
      CommunityManager: ethers.constants.AddressZero,
      EventManager: ethers.constants.AddressZero
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
          url: "https://api.pimlico.io/v2/11155111/rpc?apikey="+ import.meta.env.VITE_BUNDLER_PIMLICO_APIKEY,
        },
      },
      {
        provider: "biconomy",
        config: {
          url: "https://bundler.biconomy.io/api/v2/11155111/"+import.meta.env.VITE_BUNDLER_BICONOMY_APIKEY,
        },
      },
    ],
    paymaster: [
      {
        provider: "stackup",
        config: {
          url: "https://api.stackup.sh/v1/paymaster/"+import.meta.env.VITE_PAYMASTER_STACKUP_APIKEY,
          option: {
            type: "payg",
          },
        },
      },
      {
        provider: "pimlico",
        config: {
          url: "https://api.pimlico.io/v2/11155111/rpc?apikey="+import.meta.env.VITE_PAYMASTER_PIMLICO_APIKEY,
        },
      },
      {
        provider: "biconomy",
        config: {
          url: "https://paymaster.biconomy.io/api/v1/11155111/"+import.meta.env.VITE_PAYMASTER_BICONOMY_APIKEY,
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
          url: "https://paymaster.aastar.io/api/v1/paymaster/ethereum-sepolia?apiKey="+import.meta.env.VITE_PAYMASTER_AASTAR_APIKEY,
          option: {
            strategy_code: "a__d7MwJ",
            version: "v0.6",
          },
        },
      },
    ],
  },
  [networkIds.OP_MAINNET]: {
    name: "OP MAINNET",
    rpc: "https://mainnet.optimism.io",
    chainId: networkIds.OP_MAINNET,
    blockExplorerURL: "https://explorer.optimism.io",
    contracts: {
      USDT: "0x1927e2d716d7259d06006bfaf3dbfa22a12d6945",
      CommunityV1: ethers.constants.AddressZero,
      CommunityStoreV1: ethers.constants.AddressZero,
      CommunityStoreV2: ethers.constants.AddressZero,
      NFT: ethers.constants.AddressZero,
      CommunityManager: ethers.constants.AddressZero,
      EventManager: ethers.constants.AddressZero
    },
    bundler: [
      {
        provider: "pimlico",
        config: {
          url: `https://api.pimlico.io/v2/10/rpc?apikey=${import.meta.env.VITE_OP_MAINNET_BUNDLER_PIMLICO_APIKEY}`,
        },
      },
    ],
    paymaster: [
      {
        provider: "aastar",
        config: {
          url: `https://paymaster.aastar.io/api/v1/paymaster/optimism-mainnet?apiKey=${import.meta.env.VITE_OP_MAINNET_PAYMASTER_AASTAR_APIKEY}`,
          option: {
            strategy_code: "a__d7MwJ",
            version: "v0.6",
          },
        },
      },
    ],
  },
  [networkIds.OP_SEPOLIA]: {
    name: "OP Sepolia",
    rpc: "https://optimism-sepolia.blockpi.network/v1/rpc/public",
    chainId: networkIds.OP_SEPOLIA,
    blockExplorerURL: "https://sepolia-optimism.etherscan.io",
    contracts: {
      USDT: "0x1927E2D716D7259d06006bFaF3dBFA22A12d6945",
      NFT: "0x9194618d3695902a426bfacc9e2182d2cb6ad880",
      CommunityV1: "0x1d34bbf294172d49a8d4aa02fc772cc9f3297f9a",
      CommunityStoreV1: "0x2fa277d572f1f204e0ca580594e402b9e353c5f3",
      CommunityStoreV2: "0x6E5C88b713c977aDa9ffa2fC4C0382788A6b9714",
      CommunityManager:  "0x010dc3cc5842b1ffe3b154f150e30e6c84c91892",
      EventManager: ethers.constants.AddressZero,
    },
    bundler: [
      {
        provider: "pimlico",
        config: {
          url: "https://api.pimlico.io/v2/11155420/rpc?apikey=pim_PNTJ54EjpSADqaP5GdE3gv",
        },
      },
    ],
    paymaster: [
      {
        provider: "pimlico",
        config: {
          url: "https://api.pimlico.io/v2/11155420/rpc?apikey=pim_PNTJ54EjpSADqaP5GdE3gv",
     
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
      NFT: ethers.constants.AddressZero,
      CommunityV1: ethers.constants.AddressZero,
      CommunityStoreV1: ethers.constants.AddressZero,
      CommunityStoreV2: ethers.constants.AddressZero,
      CommunityManager:  ethers.constants.AddressZero,
      EventManager: ethers.constants.AddressZero,
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
  [networkIds.BASE_SEPOLIA]: {
    name: "Base Sepolia",
    rpc: "https://public.stackup.sh/api/v1/node/base-sepolia",
    chainId: networkIds.BASE_SEPOLIA,
    blockExplorerURL: "https://base-sepolia.blockscout.com",
    contracts: {
      USDT: "0x1927E2D716D7259d06006bFaF3dBFA22A12d6945",
      NFT: "0xCEf599508abd274bab8F0D9D9149d9ceeD9a2A07",
      CommunityV1: ethers.constants.AddressZero,
      CommunityStoreV1: ethers.constants.AddressZero,
      CommunityStoreV2: ethers.constants.AddressZero,
      CommunityManager:  ethers.constants.AddressZero,
      EventManager: ethers.constants.AddressZero,
    },
    bundler: [
      {
        provider: "stackup",
        config: {
          url: "https://public.stackup.sh/api/v1/node/base-sepolia",
        },
      },
    ],
    paymaster: [
      {
        provider: "stackup",
        config: {
          url: "https://api.stackup.sh/v1/paymaster/c5e9b2ba0b5b40b92d549aedbb0e9711e8743f22856f8906e2d146938e44fa20",
          option: {
            type: "payg",
          },
        },
      },
    ],
  },
};


export const pinata = new PinataSDK({
  pinataJwt: `${import.meta.env.VITE_PINATA_JWT}`,
  pinataGateway: `${import.meta.env.VITE_GATEWAY_URL}`
})
