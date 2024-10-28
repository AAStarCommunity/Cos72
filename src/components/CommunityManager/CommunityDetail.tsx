/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { currentCommunityAtom } from "../../atoms/Community";
import styles from "./CommunityDetail.module.css";
import { Button } from "primereact/button";

import { useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";

import { TabPanel, TabView } from "primereact/tabview";
import CommunityStoreManager from "./CommunityStore";

function CommunityDetail() {
  const currentChain = useAtomValue(currentChainAtom);
 
  const  currentCommunity = useAtomValue(currentCommunityAtom);
  if (!currentCommunity) {
    return null;
  }
  return (
    <>
       <div className={styles.Community}>
            <div>{currentCommunity.name}</div>
            <div>{currentCommunity.description}</div>
            <div className={styles.communityContractAction}><Chip
                    className={styles.CommunityCardContractAddress}
                    onClick={() => {
                      window.open(
                        `${currentChain.blockExplorerURL}/address/${currentCommunity.address}`,
                        "_blank"
                      );
                    }}
                    label={`Contract ${currentCommunity.address}`}
                  ></Chip> Contract Version : V1 <Button disabled={!currentCommunity.isAdmin} size="small">Update Community Contract</Button></div>
            <TabView >

              <TabPanel header="Store">
                <CommunityStoreManager></CommunityStoreManager>
              {/* <div className={styles.btnRow}>
                <Button
                  label="Create Goods"
                  onClick={() => {
                    setIsShowCreateCommunityGoodsDialog(true);
                  }}
                ></Button>
                </div>
                <div className={styles.CommunityGoodsList}>
                  {currentCommunity?.goodsList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityGoods}>
                        <div className={styles.CommunityGoodsLogo} ><img src={item.logo} /></div>
                        <div>Name : {item.name}</div>
                        <div>Description : {item.description}</div>
                        <div>Price: {item.price} {item.payTokenSymbol}</div>
                        <div> <Chip
                className={styles.CommunityCardContractAddress}
                onClick={() => {
                  window.open(
                    `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${item.address}`,
                    "_blank"
                  );
                }}
                label={`Contract ${item.address}`}
              ></Chip> </div>
                      </div>
                    
                    );
                  })}
                </div> */}
              </TabPanel>
            </TabView>
          </div>
    </>
  );
}

export default CommunityDetail;