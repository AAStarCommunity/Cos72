/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { communityListAtom, currentCommunityAtom } from "../../atoms/Community";
import styles from "./index.module.css";
import { Button } from "primereact/button";

import {useAtomValue, useSetAtom } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { userInfoAtom } from "../../atoms/UserInfo";

import { toast } from "react-toastify";
import { useState } from "react";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityJSON from "../../contracts/Community.json";

import TetherTokenJSON from "../../contracts/TetherToken.json";
import CreateCommunityPointTokenDialog from "../CreateCommunityPointTokenDialog";
import SentCommunityPointTokenDialog from "../SentCommunityPointTokenDialog";

const CommunityABI = CommunityJSON.abi;

const TetherTokenJSONABI = TetherTokenJSON.abi
function CommunityPointManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);

  const currentCommunity = useAtomValue(currentCommunityAtom);

  const [isShowCreateCommunityStoreDialog, setIsShowCreateCommunityStoreDialog] =
    useState(false);
  const [isShowSentCommunityPointTokenDialog, setIsShowSentCommunityPointTokenDialog] = useState(false);

  const createCommunityPointToken = async (pointToken: any) => {
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


  
      // Encode the calls
      const callTo = [
        currentCommunity.address,
      ];
      const callData = [
        CommunityContract.interface.encodeFunctionData("createPointToken", [pointToken.name, pointToken.symbol])
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
  const sendCommunityPointToken = async (sendPointToken: any) => {
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

      const tokenContract = new ethers.Contract(
        currentCommunity.pointToken,
        TetherTokenJSONABI,
        new ethers.providers.JsonRpcProvider(currentChain.rpc)
      );
      const tokenDecimals = await tokenContract.decimals();
  
      // Encode the calls
      const callTo = [
        currentCommunity.address,
      ];
      const callData = [
        CommunityContract.interface.encodeFunctionData("sendPointToken", [sendPointToken.account, ethers.utils.parseUnits(sendPointToken.amount, tokenDecimals)])
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
    //  await loadCommunityList();

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
            label="Create Point Token"
            className={styles.mintUSDTBtn}
            onClick={() => {
                setIsShowCreateCommunityStoreDialog(true);
            }}
          />
        </div>
        
        <div className={styles.PointTokenAction}>Point Token :     <Chip
                    className={styles.CommunityCardContractAddress}
                    onClick={() => {
                      window.open(
                        `${currentChain.blockExplorerURL}/address/${currentCommunity?.pointToken}`,
                        "_blank"
                      );
                    }}
                    label={`Contract ${currentCommunity?.pointToken}`}
                  ></Chip>  <Button onClick={() => {
            setIsShowSentCommunityPointTokenDialog(true);
        }}>Send</Button></div> 
      </div>
      <CreateCommunityPointTokenDialog
        visible={isShowCreateCommunityStoreDialog}
        onHide={() => {
          setIsShowCreateCommunityStoreDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          await createCommunityPointToken(data);
          callback();
          setIsShowCreateCommunityStoreDialog(false);
        }}
      ></CreateCommunityPointTokenDialog>
          <SentCommunityPointTokenDialog
        visible={isShowSentCommunityPointTokenDialog}
        onHide={() => {
          setIsShowSentCommunityPointTokenDialog(false);
        }}
        onCreate={async (data: any, callback: any) => {
          if (currentCommunity) {
            await sendCommunityPointToken(data);
            callback();
            setIsShowSentCommunityPointTokenDialog(false);
          }
        }}
      ></SentCommunityPointTokenDialog>
    </>
  );
}

export default CommunityPointManager;
