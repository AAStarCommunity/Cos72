/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { Community, communityListAtom, Store } from "../../atoms/Community";
import styles from "./index.module.css";
import { Button } from "primereact/button";
import { DataView } from "primereact/dataview";
import {useAtom, useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { userInfoAtom } from "../../atoms/UserInfo";

import { toast } from "react-toastify";
import { useState } from "react";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityJSON from "../../contracts/Community.json";
import CommunityStoreJSON from "../../contracts/CommunityStore.json";

import CreateCommunityStoreDialog from "../CreateCommunityStoreDialog";
import { useAccount } from "wagmi";
import { useNavigate, useParams } from "react-router-dom";
import { find } from "lodash";
import { Card } from "primereact/card";

const CommunityABI = CommunityJSON.abi;
const CommunityStoreABI = CommunityStoreJSON.abi;
function CommunityStoreManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const [communityList, loadCommunityList] = useAtom(communityListAtom);
  const account = useAccount();

  const [isShowCreateCommunityStoreDialog, setIsShowCreateCommunityStoreDialog] =
    useState(false);
    let { address } = useParams();
    const navigate = useNavigate()
    const  currentCommunity = find(communityList, (item: Community) => {
      return item.address === address;
    })
    if (!currentCommunity) {
      return null;
    }
  const communityStoreTemplate = (storeList: Store[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {storeList.map((store: Store) => {
          return (
            <Card
              title={store.name}
              className={styles.CommunityCard}
              key={store.address}
              onClick={() => {
                navigate(`/admin/community/${currentCommunity.address}/store/${store.address}`)
              }}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityImg}>
                <img src={store.logo}></img>
              </div>
              <div className={styles.CommunityCardInfo}>    <div className={styles.CommunityText}>{store.description}</div>
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
            </Card>
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
          [currentChain.contracts.CommunityStoreV2, data]
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
      await loadCommunityList((userInfo as any).aa);

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

  const createCommunityStoreByEOA = async (store: any) => {
    if (!currentCommunity) {
        return;
    }
    if (!account.address || !account.connector) {
      return;
    }
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
 
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);

      const CommunityContract = new ethers.Contract(
        currentCommunity.address,
        CommunityABI,
        provider.getSigner()
      );


      const CommunityStoreContract = new ethers.Contract(
        currentChain.contracts.CommunityStoreV1,
        CommunityStoreABI,
        provider.getSigner()
      );
      // Encode the calls
   
      const data = CommunityStoreContract.interface.encodeFunctionData("initialize", [account.address, store])
      // const callData = [
      //   CommunityContract.interface.encodeFunctionData(
      //     "createStore",
      //     [currentChain.contracts.CommunityStoreV1, data]
      //   ),
      // ];
      console.log("Waiting for transaction...");

      const transactionObject = await CommunityContract.createStore(currentChain.contracts.CommunityStoreV2, data);
   //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash)
    
      console.log(`Transaction hash: ${transactionObject.hash}`);


      //console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityList(account.address);

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
            disabled={(!userInfo && !account.address) || !currentCommunity?.isAdmin}
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
          if (account.address) {
            await createCommunityStoreByEOA(data);
          }
          else if (userInfo) {
            await createCommunityStore(data);
          }
          
          callback();
          setIsShowCreateCommunityStoreDialog(false);
        }}
      ></CreateCommunityStoreDialog>
    </>
  );
}

export default CommunityStoreManager;
