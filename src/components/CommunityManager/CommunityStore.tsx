/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { communityListAtom, currentCommunityAtom, currentCommunityStoreAtom, Store } from "../../atoms/Community";
import styles from "./index.module.css";
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

const CommunityABI = CommunityJSON.abi;
const CommunityStoreABI = CommunityStoreJSON.abi;
function CommunityStoreManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);

  const setCurrentPath = useSetAtom(currentPathAtom);
  const currentCommunity = useAtomValue(currentCommunityAtom);
  const setCurrentCommunityStore = useSetAtom(currentCommunityStoreAtom);
  const [isShowCreateCommunityStoreDialog, setIsShowCreateCommunityStoreDialog] =
    useState(false);
  const communityStoreTemplate = (storeList: Store[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {storeList.map((store: Store) => {
          return (
            <div
              className={styles.CommunityCard}
              key={store.address}
              onClick={() => {
                setCurrentCommunityStore(store);
                 setCurrentPath("community-store-detail");
              }}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityImg}>
                <img src={store.logo}></img>
              </div>
              <div className={styles.CommunityCardInfo}>
                <div className={styles.CommunityText}>{store.name}</div>
                <div className={styles.CommunityText}>{store.description}</div>
                <div className={styles.CommunityText}>
                  <Chip
                    className={styles.CommunityCardContractAddress}
                    onClick={() => {
                      window.open(
                        `${currentChain.blockExplorerURL}/address/${store.address}`,
                        "_blank"
                      );
                    }}
                    label={`Contract ${store.address}`}
                  ></Chip>
                </div>
              </div>
              <div></div>
            </div>
          );
        })}
      </div>
    );
  };
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
  return (
    <>
      <div className={styles.Community}>
        <div className={styles.btnRow}>
          <Button
            disabled={!userInfo || !currentCommunity?.isAdmin}
            label="Create Store"
            className={styles.mintUSDTBtn}
            onClick={() => {
                setIsShowCreateCommunityStoreDialog(true);
            }}
          />
        </div>
        {
            currentCommunity &&   <DataView
            className={styles.CommunityDataView}
            value={currentCommunity.storeList}
            listTemplate={communityStoreTemplate as any}
          ></DataView>
        }
      
      </div>
      <CreateCommunityStoreDialog
        visible={isShowCreateCommunityStoreDialog}
        onHide={() => {
          setIsShowCreateCommunityStoreDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          await createCommunityStore(data);
          callback();
          setIsShowCreateCommunityStoreDialog(false);
        }}
      ></CreateCommunityStoreDialog>
    </>
  );
}

export default CommunityStoreManager;
