/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtomValue } from "jotai";
import { TabPanel, TabView } from "primereact/tabview";
import { Community, communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./Goods.module.css";
import GoodsList from "./components/GoodsList";
import StoreList from "./components/StoreList";
import CommunityList from "./components/CommunityList";


function GoodsApp() {
  const communityList = useAtomValue(communityListAtom);

  const allCommunity: Community [] = [];
  const allGoods: Goods[] = [];
  const allStore: Store[] = [];
  communityList.forEach((community) => {
    community.storeList.forEach((store: Store) => {
      allStore.push(store);
      store.goodsList.forEach((goods) => {
        allGoods.push(goods);
      });
    });
    allCommunity.push(community)
  });


  return (
    <div className={styles.Root}>
      <TabView>
        <TabPanel header="All Goods">
          <GoodsList data={allGoods}></GoodsList>
        </TabPanel>
        <TabPanel header="Store">
          <StoreList data={allStore}></StoreList>
        </TabPanel>
        <TabPanel header="Community"> 
          <CommunityList data={allCommunity}></CommunityList>
        </TabPanel>
      </TabView>
    </div>
  );
}

export default GoodsApp;
