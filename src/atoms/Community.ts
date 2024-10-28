import { ethers } from "ethers";
import { atom } from "jotai";
import { INetwork, pinata } from "../config";
import { MulticallWrapper } from "ethers-multicall-provider";
import CommunityManagerJSON from "../contracts/CommunityManager.json";
import CommunityStoreJSON from "../contracts/CommunityStore.json";
import CommunityJSON from "../contracts/Community.json";
import { currentChainAtom } from "./CurrentChain";
import { userInfoAtom } from "./UserInfo";
import { find } from "lodash";
const CommunityManagerABI = CommunityManagerJSON.abi;
const CommunityABI = CommunityJSON.abi;
const CommunityStoreABI = CommunityStoreJSON.abi;

export interface Store {
  name: string;
  address: string;
  description: string;
  logo: string;
  isAdmin: boolean;
  goodsList: Goods[];
}

export interface Goods {
  id: number;
  name: string;
  description: string;
  images: string[];
  descImages: string[];
  price: number;
}

export interface Community {
  name: string;
  address: string;
  description: string;
  logo: string;
  isAdmin: boolean;
  storeList: Store[];
}

//MulticallWrapper

const communityList = atom<Community[]>([]);
const currentCommunity = atom<Community | null>(null);
const currentCommunityStore = atom<Store | null>(null);
export const loadCommunityListLoadingAtom = atom(false);
const loadCommunityList = async (currentNetwork: INetwork, account: string) => {
  const provider = new ethers.providers.JsonRpcProvider(currentNetwork.rpc);

  console.log(
    "loadCommunityList",
    currentNetwork.rpc,
    currentNetwork.contracts.CommunityManager
  );
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
    console.log(communityInfo);
    const logo = await pinata.gateways.createSignedURL({
      cid: communityInfo.setting.logo,
      expires: 365 * 24 * 60 * 60,
    });
    console.log("logo", logo);
    const storeAddressList = communityInfo.storeList;
    const storeList: Store[] = [];
    for (let m = 0, n = storeAddressList.length; m < n; m++) {
      const communityStore = new ethers.Contract(
        storeAddressList[m],
        CommunityStoreABI,
        provider
      );
      const storeInfo = await communityStore.getStoreInfo(account);
      const storeLogo = await pinata.gateways.createSignedURL({
        cid: storeInfo.setting.image,
        expires: 365 * 24 * 60 * 60,
      });
      const goodsList: Goods[] = [];
      for (let x = 0, y = storeInfo.goodsList.length; x < y; x++) {
        const goodsData = storeInfo.goodsList[x];
        const images = await Promise.all(
          goodsData.images.map(async (item: string) => {
            const newUrls = await pinata.gateways.createSignedURL({
              cid: item,
              expires: 365 * 24 * 60 * 60,
            });
            return newUrls;
          })
        );
        const descImages = await Promise.all(
          goodsData.descImages.map(async (item: string) => {
            const newUrls = await pinata.gateways.createSignedURL({
              cid: item,
              expires: 365 * 24 * 60 * 60,
            });
            return newUrls;
          })
        );
        goodsList.push({
          id: goodsData.id.toNumber(),
          name: goodsData.name,
          description: goodsData.description,
          images,
          descImages,
          price: Number(
            ethers.utils.formatUnits(
              goodsData.price,
              goodsData.payTokenDecimals
            )
          ),
        });
      }

      storeList.push({
        address: storeAddressList[i],
        logo: storeLogo,
        name: storeInfo.setting.name,
        description: storeInfo.setting.description,
        isAdmin: storeInfo.isAdmin,
        goodsList: goodsList,
      });
      console.log(storeInfo);
    }
    list.push({
      address: result[i],
      logo: logo,
      name: communityInfo.setting.name,
      description: communityInfo.setting.description,
      isAdmin: communityInfo.isAdmin,
      storeList,
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
    set(loadCommunityListLoadingAtom, true);
    const list = await loadCommunityList(
      currentNetwork,
      userInfo ? (userInfo as any).aa : ethers.constants.AddressZero
    );
    set(communityList, list);
    const _currentCommunity = get(currentCommunity);
    if (_currentCommunity) {
      const data = find(list, (value: Community) => {
        return value.address === _currentCommunity.address;
      });
      if (data) {
        set(currentCommunity, data);
        const _currentCommunityStore = get(currentCommunityStore);
        if (_currentCommunityStore) {
          const data2 = find(data.storeList, (value: Store) => {
            return value.address === _currentCommunityStore.address;
          });
          if (data2) {
            set(currentCommunityStore, data2);
          }
        }
      }
    }

    set(loadCommunityListLoadingAtom, false);
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

export const currentCommunityStoreAtom = atom(
  (get) => {
    return get(currentCommunityStore);
  },
  async (_get, set, store: Store) => {
    set(currentCommunityStore, store);
    // set(currentChainIdAtom, chainId);
  }
);