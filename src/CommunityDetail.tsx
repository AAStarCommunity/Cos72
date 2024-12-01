/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtomValue } from "jotai";
import { TabPanel, TabView } from "primereact/tabview";
import { Community, communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./StoreDetail.module.css";

import { useParams } from "react-router-dom";
import { find } from "lodash";
import GoodsList from "./components/GoodsList";

import StoreList from "./components/StoreList";
import CommunityInfo from "./components/CommunityInfo";


function CommunityDetail() {
  const communityList = useAtomValue(communityListAtom);
  let { address } = useParams();

  const currentCommunity = find(communityList, (item: Community) => {
    return item.address === address;
  });
  if (!currentCommunity) {
    return null;
  }


  const allGoods: Goods[] = [];
  const allStore: Store[] = [];
  currentCommunity.storeList.forEach((store: Store) => {
    allStore.push(store);
    store.goodsList.forEach((goods) => {
      allGoods.push(goods);
    });
  });


  return (
    <div className={styles.Root}>
        <CommunityInfo data={currentCommunity}></CommunityInfo>
      {/* <StoreInfo data={currentCommunityStore}></StoreInfo> */}
      <TabView>
        <TabPanel header="All Goods">
            <GoodsList data={allGoods}></GoodsList>
        </TabPanel>
        <TabPanel header="Store">
            <StoreList data={allStore}></StoreList>
        </TabPanel>
      </TabView>
    </div>
  );
}

export default CommunityDetail;
