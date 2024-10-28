/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import { communityListAtom, currentCommunityAtom, currentCommunityStoreAtom, Goods, Store } from "../../atoms/Community";
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
import CommunityStoreJSON from "../../contracts/CommunityStore.json";
import TetherTokenJSON from "../../contracts/TetherToken.json";
import { currentPathAtom } from "../../atoms/CurrentPath";

import CreateCommunityGoodsDialog from "../CreateCommunityGoodsDialog";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';

const CommunityStoreABI = CommunityStoreJSON.abi;
const TetherTokenABI = TetherTokenJSON.abi;
function CommunityStoreGoodsManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);

  const setCurrentPath = useSetAtom(currentPathAtom);
  const currentCommunity = useAtomValue(currentCommunityAtom);
  const currentCommunityStore = useAtomValue(currentCommunityStoreAtom);
  const [isShowCreateCommunityGoodsDialog, setIsShowCreateCommunityGoodsDialog] =
    useState(false);
  const communityGoodsTemplate = (goodsList: Goods[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {goodsList.map((goods: Goods) => {
          return (
            <div
              className={styles.CommunityCard}
              key={goods.id}
              onClick={() => {
               
              }}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityGoodsImg}>
                
                     <Swiper navigation={true} modules={[Navigation]} className="mySwiper">
                    {goods.images.map((item:string) => {
                        return  <SwiperSlide key={item}><img src={item}></img></SwiperSlide>
                    })}
                    </Swiper>
                
                {/* <img src={store.logo}></img> */}
              </div>
              <div className={styles.CommunityCardInfo}>
                <div className={styles.CommunityText}>{goods.name}</div>
                <div className={styles.CommunityText}>{goods.description}</div>
               
              </div>
              <div></div>
            </div>
          );
        })}
      </div>
    );
  };
  const createCommunityStoreGoods = async (communityGoods: any) => {
    if (!currentCommunityStore) {
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





      const CommunityStoreContract = new ethers.Contract(
        currentCommunityStore?.address,
        CommunityStoreABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );

      const tokenContract = new ethers.Contract(
        communityGoods.payToken,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
            currentChain.rpc
          )
      );
      const tokenDecimals = await tokenContract.decimals()
      // Encode the calls
      const callTo = [
        currentCommunityStore.address,
      ];
      const goodsData =   {
        id: 0,

        name: communityGoods.name,
        description: communityGoods.description,
        images: communityGoods.images.split(","),
        descImages: communityGoods.descImages.split(","),
        payToken: communityGoods.payToken,
        payTokenSymbol: "",
        payTokenDecimals: 0,
        amount: ethers.BigNumber.from(communityGoods.amount),
        price:  ethers.utils.parseUnits(communityGoods.price, tokenDecimals),
      }
      console.log(goodsData)
      const callData = [
        CommunityStoreContract.interface.encodeFunctionData(
          "addGoods",
          [
            goodsData
          
            
          ]
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
            label="Add Goods"
            className={styles.mintUSDTBtn}
            onClick={() => {
                setIsShowCreateCommunityGoodsDialog(true);
            }}
          />
        </div>
        {
            currentCommunityStore &&   <DataView
            className={styles.CommunityDataView}
            value={currentCommunityStore.goodsList}
            listTemplate={communityGoodsTemplate as any}
          ></DataView>
        }
      
      </div>
      <CreateCommunityGoodsDialog
        visible={isShowCreateCommunityGoodsDialog}
        onHide={() => {
          setIsShowCreateCommunityGoodsDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          await createCommunityStoreGoods(data);
          callback();
          setIsShowCreateCommunityGoodsDialog(false);
        }}
      ></CreateCommunityGoodsDialog>
    </>
  );
}

export default CommunityStoreGoodsManager;
