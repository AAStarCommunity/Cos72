/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtomValue } from "jotai";
import { TabPanel, TabView } from "primereact/tabview";
import { Community, communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./StoreDetail.module.css";

import { useParams } from "react-router-dom";
import { find } from "lodash";
import GoodsList from "./components/GoodsList";
import StoreInfo from "./components/StoreInfo";


function StoreDetail() {
  const communityList = useAtomValue(communityListAtom);
  let { address, storeAddress } = useParams();

  const currentCommunity = find(communityList, (item: Community) => {
    return item.address === address;
  });
  if (!currentCommunity) {
    return null;
  }

  const currentCommunityStore = find(
    currentCommunity.storeList,
    (item: Store) => {
      return item.address === storeAddress;
    }
  );

  if (!currentCommunityStore) {
    return null;
  }
  const allGoods: Goods[] = [];

  currentCommunityStore.goodsList.forEach((goods) => {
    allGoods.push(goods);
  });


  return (
    <div className={styles.Root}>
      <StoreInfo data={currentCommunityStore}></StoreInfo>
      <TabView>
        <TabPanel header="All Goods">
            <GoodsList data={allGoods}></GoodsList>
        </TabPanel>
      </TabView>
    </div>
  );
}

export default StoreDetail;
