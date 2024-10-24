/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { Community, communityListAtom, currentCommunityAtom } from "../../atoms/Community";
import styles from "./index.module.css";
import { Button } from "primereact/button";
import { DataView } from "primereact/dataview";
import { useAtom, useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { userInfoAtom } from "../../atoms/UserInfo";
import CreateCommunityDialog from "../CreateCommunityDialog";
import { toast } from "react-toastify";
import { useState } from "react";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityManagerJSON from "../../contracts/CommunityManager.json";
import CommunityJSON from "../../contracts/Community.json";
import { TabPanel, TabView } from "primereact/tabview";
const CommunityManagerABI = CommunityManagerJSON.abi;
const CommunityABI = CommunityJSON.abi;
function CommunityDetail() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const  currentCommunity = useAtomValue(currentCommunityAtom);
  if (!currentCommunity) {
    return null;
  }
  return (
    <>
       <div className={styles.Community}>
            <div>{currentCommunity.name}</div>
            <div>{currentCommunity.description}</div>

            <TabView>
              <TabPanel header="Point">
                {/* <div>
                  Point Token : {currentCommunity?.pointToken}{" "}
                  <Button
                    label="Create"
                    onClick={() => {
                      setIsShowCreateCommunityPointTokenDialog(true);
                    }}
                  />{" "}
                  <Button
                    label="Sent"
                    onClick={() => {
                      setIsShowSentCommunityPointTokenDialog(true);
                    }}
                  ></Button>
                </div>

                <div>
                  Point Balance: {currentCommunity?.formatPointTokenBalance}{" "}
                </div> */}
              </TabPanel>
              <TabPanel header="NFT">
                {/* <Button
                  label="Create NFT"
                  onClick={() => {
                    setIsShowCreateCommunityNFTDialog(true);
                  }}
                ></Button>
                <div>
                  {currentCommunity?.nftList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityNFT}>
                        <div>Name : {item.name}</div>
                        <div>Symbol : {item.symbol}</div>
                        <div>Price: {ethers.utils.formatEther(item.price)}</div>
                        <div>
                          {" "}
                          <Button
                            label="Approve"
                            onClick={() => {
                              setIsShowCreateCommunityNFTDialog(true);
                            }}
                          ></Button>
                          <Button
                            label="Buy"
                            onClick={() => {
                              setIsShowCreateCommunityNFTDialog(true);
                            }}
                          ></Button>
                        </div>
                      </div>
                    );
                  })}
                </div> */}
              </TabPanel>
              <TabPanel header="Store">
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
