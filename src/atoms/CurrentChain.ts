import { atomWithStorage } from "jotai/utils";
import { NetworkdConfig, NetworkId, networkIds } from "../config";
import { atom } from "jotai";

const currentChainIdAtom = atomWithStorage<number>(
  "__currentChain__",
  networkIds.OP_SEPOLIA
);

export const currentChainAtom = atom(
  (get) => {
    const chainId = get(currentChainIdAtom);
    return NetworkdConfig[parseInt(`${chainId}`) as NetworkId];
  },
  (_get, set, chainId: any) => {
    set(currentChainIdAtom, chainId);
  },
)
