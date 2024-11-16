/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { Community, communityListAtom } from "../../atoms/Community";
import styles from "./CommunityDetail.module.css";
import { Button } from "primereact/button";

import { useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";

import { TabPanel, TabView } from "primereact/tabview";
import CommunityStoreManager from "./CommunityStore";
import CommunityPointManager from "./CommunityPoint";
import { useParams } from "react-router-dom";
import { find } from "lodash";
import { Panel } from "primereact/panel";

function CommunityDetail() {
  const currentChain = useAtomValue(currentChainAtom);
  const communityList = useAtomValue(communityListAtom)
  let { address } = useParams();
  const  currentCommunity = find(communityList, (item: Community) => {
    return item.address === address;
  })
  if (!currentCommunity) {
    return null;
  }
  return (
    <>
       <Panel header={currentCommunity.name}>
           
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
              <TabPanel header="Point">
                <CommunityPointManager></CommunityPointManager>
              </TabPanel>
            </TabView>
          </Panel>
    </>
  );
}

export default CommunityDetail;
