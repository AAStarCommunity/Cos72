/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { currentCommunityAtom, currentCommunityStoreAtom } from "../../atoms/Community";
import styles from "./CommunityStoreDetail.module.css";
import { Button } from "primereact/button";
import {useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";

import { TabPanel, TabView } from "primereact/tabview";
import CommunityStoreGoodsManager from "./CommunityStoreGoods";


function CommunityStoreDetail() {
  const currentChain = useAtomValue(currentChainAtom);

 // const setCurrentPath = useSetAtom(currentPathAtom);
  const currentCommunity = useAtomValue(currentCommunityAtom);
  const currentCommunityStore = useAtomValue(currentCommunityStoreAtom)

 

  if (!currentCommunityStore || !currentCommunity) {
    return null;
  }
  return (
    <>
       <div className={styles.Community}>
            <div>{currentCommunityStore.name}</div>
            <div>{currentCommunityStore.description}</div>
            <div className={styles.communityContractAction}><Chip
                    className={styles.CommunityCardContractAddress}
                    onClick={() => {
                      window.open(
                        `${currentChain.blockExplorerURL}/address/${currentCommunityStore.address}`,
                        "_blank"
                      );
                    }}
                    label={`Contract ${currentCommunityStore.address}`}
                  ></Chip> Contract Version : V1 <Button disabled={!currentCommunity.isAdmin} size="small">Update Store Contract</Button></div>
            <TabView >

              <TabPanel header="Goods">
                    <CommunityStoreGoodsManager></CommunityStoreGoodsManager>
              </TabPanel>
            </TabView>
          </div>
    </>

  );
}

export default CommunityStoreDetail;
