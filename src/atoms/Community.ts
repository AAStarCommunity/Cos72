import { ethers } from "ethers";
import { atom } from "jotai";
import { INetwork, pinata } from "../config";
import { MulticallWrapper } from "ethers-multicall-provider";
import CommunityManagerJSON from "../contracts/CommunityManager.json";
import CommunityJSON from "../contracts/Community.json";
import { currentChainAtom } from "./CurrentChain";
import { userInfoAtom } from "./UserInfo";
const CommunityManagerABI = CommunityManagerJSON.abi;
const CommunityABI = CommunityJSON.abi;
export interface Community {
  name: string;
  address: string;
  description: string;
  logo: string;
}

//MulticallWrapper

const communityList = atom<Community []>([]);
const currentCommunity = atom<Community | null>(null);
const loadCommunityList = async (currentNetwork: INetwork, account: string) => {
  const provider =
    new ethers.providers.JsonRpcProvider(
      currentNetwork.rpc
    )
  
  console.log("loadCommunityList",currentNetwork.rpc,  currentNetwork.contracts.CommunityManager)
  const communityManager = new ethers.Contract(
    currentNetwork.contracts.CommunityManager,
    CommunityManagerABI,
    provider
  );
  const result = await communityManager.getCommunityList();
  console.log(result);
  const list: Community[] = [];
  for (let i = 0, l = result.length; i < l; i++) {
    const community = new ethers.Contract(result[i], CommunityABI, provider);
    const [communityInfo] = await Promise.all([
      community.getCommunityInfo(account),
    ]);
    const logo = await pinata.gateways.createSignedURL({
      cid: communityInfo.setting.logo,
      expires: 30
  })
    list.push({
      address: result[i],
      logo: logo,
      name: communityInfo.setting.name,
      description: communityInfo.setting.description
    });
  }


  return list;
};
export const communityListAtom = atom(
  (get) => {
    return get(communityList);
  },
  async (get, set) => {
    const currentNetwork = get(currentChainAtom);
    const userInfo = get(userInfoAtom);
    const list = await loadCommunityList(currentNetwork, userInfo? (userInfo as any).aa : ethers.constants.AddressZero);
    set(communityList, list);
    // set(currentChainIdAtom, chainId);
  }
);

export const currentCommunityAtom = atom(
  (get) => {
    return get(currentCommunity);
  },
  async (_get, set, community: Community) => {
   
    set(currentCommunity, community);
    // set(currentChainIdAtom, chainId);
  }
);
