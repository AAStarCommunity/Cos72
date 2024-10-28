
import { INetwork } from "../config";
import { atom } from "jotai";
import { AirAccountAPI } from "../sdk/account/AirAccountAPI";
import { ethers } from "ethers";
import { entryPointAddress } from "../sdk/AAStarClient";
import { currentChainAtom } from "./CurrentChain";

const userInfo = atom(null);
const loadUserInfo = async (currentChain: INetwork) => {
    const airAccount = new AirAccountAPI({
      provider: new ethers.providers.JsonRpcProvider(
        currentChain.rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    try {
      const result = await airAccount.getAccountInfo();
      if (result) {
       return result;
      } else {
       return null;
      }
    } catch (error) {
      return null;
    }
  };
  const signOut = async (currentChain: INetwork) => {
    const airAccount = new AirAccountAPI({
      provider: new ethers.providers.JsonRpcProvider(
        currentChain.rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    try {
     airAccount.signOut();
     return true;
    } catch (error) {
      return false;
    }
  };
export const userInfoAtom = atom(
  (get) => {
    return get(userInfo);
  },
  async (get, set, action = "load") => {
    const currentChain = get(currentChainAtom);
    if (action == "load") {
        const data = await loadUserInfo(currentChain)
        set(userInfo, data);
    }
    else if (action === "signOut") {
        await signOut(currentChain);
        set(userInfo, null);
    }
  },
)
