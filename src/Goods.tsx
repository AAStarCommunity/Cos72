/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtomValue } from "jotai";
import { TabPanel, TabView } from "primereact/tabview";
import { communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./Goods.module.css";

import { useNavigate } from "react-router-dom";
import GoodsList from "./components/GoodsList";


function GoodsApp() {
  const communityList = useAtomValue(communityListAtom);

  const navigate = useNavigate();
  const allGoods: Goods[] = [];
  const allStore: Store[] = [];
  communityList.forEach((community) => {
    community.storeList.forEach((store: Store) => {
      allStore.push(store);
      store.goodsList.forEach((goods) => {
        allGoods.push(goods);
      });
    });
  });


  return (
    <div className={styles.Root}>
      <TabView>
        <TabPanel header="All Goods">
          <GoodsList data={allGoods}></GoodsList>
        </TabPanel>
        <TabPanel header="Store">
          <div className={styles.StoreList}>
            {allStore.map((store: Store) => {
              return (
                <div className={styles.Store} key={`${store.address}`} onClick={() => {
                  navigate(`/community/${store.communityAddress}/store/${store.address}`)
                }}>
                  <div className={styles.StoreInfo}>
                    <img src={store.logo} className={styles.StoreImage}></img>
                    <div className={styles.GoodsName}>{store.name}</div>
                  </div>
                  <div className={styles.StoreGoodsList}>
                    {store.goodsList.map((item) => {
                      return (
                        <div
                          className={styles.StoreGoods}
                          key={`${item.storeAddress}-${item.id}`}
                        >
                          <img
                            src={item.images[0]}
                            className={styles.StoreGoodsImage}
                          ></img>

                          <div className={styles.StoreGoodsPrice}>
                            <div>
                              {item.price} {item.payTokenSymbol}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabPanel>
        <TabPanel header="Community"> </TabPanel>
      </TabView>
    </div>
  );
}

export default GoodsApp;
