/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { Community, communityListAtom } from "../../atoms/Community";
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

import { useAccount } from "wagmi";
import { Panel } from "primereact/panel";
import { Card } from "primereact/card";
import { useNavigate } from "react-router-dom";
const CommunityManagerABI = CommunityManagerJSON.abi;
const CommunityABI = CommunityJSON.abi;
function CommunityManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const [communityList, loadCommunityList] = useAtom(communityListAtom);
  const account = useAccount();
  const navigate = useNavigate();
  const canAdminCommunityList = communityList.filter(item => {
    return item.isAdmin === true
  });
  console.log("CommunityManager", communityList, canAdminCommunityList)
  const [isShowCreateCommunityDialog, setIsShowCreateCommunityDialog] =
    useState(false);
  const communityTemplate = (communityList: Community[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {communityList.map((community: Community) => {
          return (
            <Card
              title={community.name}
              className={styles.CommunityCard}
              key={community.address}
              onClick={() => {
                navigate(`/admin/community/${community.address}`)
              }}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityImg}>
                <img src={community.logo}></img>
              </div>
              <div className={styles.CommunityCardInfo}>
             
                <div className={styles.CommunityText}>{community.description}</div>
                <div className={styles.CommunityText}>
                  <Chip
                    className={styles.CommunityCardContractAddress}
                    onClick={() => {
                      window.open(
                        `${currentChain.blockExplorerURL}/address/${community.address}`,
                        "_blank"
                      );
                    }}
                    label={`Contract ${community.address}`}
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
  const createCommunity = async (community: any) => {
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

      // 第二步 创建合约调用参数
      const CommunityManagerContract = new ethers.Contract(
        currentChain.contracts.CommunityManager,
        CommunityManagerABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );
      const CommunityContract = new ethers.Contract(
        currentChain.contracts.CommunityV1,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );
      // Encode the calls
      const callTo = [
        currentChain.contracts.CommunityManager,
      ];


      const data = CommunityContract.interface.encodeFunctionData("initialize", [(userInfo as any).aa, community])
      const callData = [
        CommunityManagerContract.interface.encodeFunctionData(
          "createCommunity",
          [currentChain.contracts.CommunityV1, data]
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

  const createCommunitByEOA = async (community: any) => {
    
    if (!account.connector || !account.address) {
      return;
    }
    const id = toast.loading("Please wait...");
    //do something else
    try {
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);
      // 第二步 创建合约调用参数
      const CommunityManagerContract = new ethers.Contract(
        currentChain.contracts.CommunityManager,
        CommunityManagerABI,
        provider.getSigner()
      );
      const CommunityContract = new ethers.Contract(
        currentChain.contracts.CommunityV1,
        CommunityABI,
        provider.getSigner()
      );
  

      const data = CommunityContract.interface.encodeFunctionData("initialize", [account.address, community])

      // const callData = [
      //   CommunityManagerContract.interface.encodeFunctionData(
      //     "createCommunity",
      //     [currentChain.contracts.CommunityV1, data]
      //   ),
      // ];
      console.log("Waiting for transaction...");

      const transactionObject = await CommunityManagerContract.createCommunity(currentChain.contracts.CommunityV1, data);
   //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash)
    
      console.log(`Transaction hash: ${transactionObject.hash}`);
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
      <Panel header="Community Management">
        <div className={styles.btnRow}>
          <Button
            disabled={(!userInfo && !account.address) && currentChain.contracts.CommunityManager !== ethers.constants.AddressZero}
            label="Create Community"
            className={styles.mintUSDTBtn}
            onClick={() => {
              setIsShowCreateCommunityDialog(true);
            }}
          />
        </div>
        <DataView
          className={styles.CommunityDataView}
          value={canAdminCommunityList}
          listTemplate={communityTemplate as any}
        ></DataView>
      </Panel>
      <CreateCommunityDialog
        visible={isShowCreateCommunityDialog}
        onHide={() => {
          setIsShowCreateCommunityDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          if (account && account.connector) {
            await createCommunitByEOA(data);
          }
          else if (userInfo) {
            await createCommunity(data);
          }
         
          callback();
          setIsShowCreateCommunityDialog(false);
        }}
      ></CreateCommunityDialog>
    </>
  );
}

export default CommunityManager;
