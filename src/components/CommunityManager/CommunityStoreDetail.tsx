/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { communityListAtom, currentCommunityAtom, currentCommunityStoreAtom, Store } from "../../atoms/Community";
import styles from "./CommunityStoreDetail.module.css";
import { Button } from "primereact/button";
import { DataView } from "primereact/dataview";
import {useAtomValue, useSetAtom } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { userInfoAtom } from "../../atoms/UserInfo";

import { toast } from "react-toastify";
import { useState } from "react";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityJSON from "../../contracts/Community.json";
import CommunityStoreJSON from "../../contracts/CommunityStore.json";
import { currentPathAtom } from "../../atoms/CurrentPath";
import CreateCommunityStoreDialog from "../CreateCommunityStoreDialog";
import { TabPanel, TabView } from "primereact/tabview";
import CommunityStoreGoodsManager from "./CommunityStoreGoods";

const CommunityABI = CommunityJSON.abi;
const CommunityStoreABI = CommunityStoreJSON.abi;
function CommunityStoreDetail() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);

  const setCurrentPath = useSetAtom(currentPathAtom);
  const currentCommunity = useAtomValue(currentCommunityAtom);
  const currentCommunityStore = useAtomValue(currentCommunityStoreAtom)
  const [isShowCreateCommunityStoreDialog, setIsShowCreateCommunityStoreDialog] =
    useState(false);
 
  const createCommunityStore = async (store: any) => {
    if (!currentCommunity) {
        return;
    }
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentChain.bundler[0];

      const payMasterConfig =
      currentChain.paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentChain.rpc, // rpc节点地址,
      });


      const CommunityContract = new ethers.Contract(
        currentChain.contracts.CommunityV1,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );


      const CommunityStoreContract = new ethers.Contract(
        currentChain.contracts.CommunityStoreV1,
        CommunityStoreABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );
      // Encode the calls
      const callTo = [
        currentCommunity.address,
      ];
      const data = CommunityStoreContract.interface.encodeFunctionData("initialize", [(userInfo as any).aa, store])
      const callData = [
        CommunityContract.interface.encodeFunctionData(
          "createStore",
          [currentChain.contracts.CommunityStoreV1, data]
        ),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityList();

      // setTransactionLogs((items) => {
      //   const newItems = [...items];
      //   newItems.unshift({
      //     aaAccount: response.aaAccountAddress,
      //     userOpHash: response.userOpHash,
      //     transactionHash: `${response.transactionHash}`,
      //   });
      //   localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
      //   return newItems;
      // });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };
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
