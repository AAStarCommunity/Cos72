/* eslint-disable @typescript-eslint/no-explicit-any */

import styles from "./index.module.css";
import { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { ethers } from "ethers";
import { MulticallWrapper } from "ethers-multicall-provider";
import { NetworkdConfig, networkIds } from "../../../config";
import Community from "../../../contracts/Community.json";

import CommunityGoods from "../../../contracts/CommunityGoods.json";
import TetherToken from "../../../contracts/TetherToken.json";
import Loading from "../Loading";
import { Button } from "primereact/button";
import { AAStarClient } from "../../../sdk";
import { useAtomValue } from "jotai";
import { communityListAtom, Goods, loadCommunityListLoadingAtom } from "../../../atoms/Community";
const CommunityABI = Community.abi;
const CommunityGoodsABI = CommunityGoods.abi;
const TetherTokenABI = TetherToken.abi;
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
interface AccountSignDialogParams {
  
}

function GoodsList({  }: AccountSignDialogParams) {
  const communityList = useAtomValue(communityListAtom)
 
  const loadCommunityListLoading = useAtomValue(loadCommunityListLoadingAtom)

  const goodsList: Goods [] = [];
  communityList.forEach((community) => {
    community.storeList.forEach((store) => {
      store.goodsList.forEach((goods) => {
        goodsList.push(goods)
      })
    })
  })
  console.log(goodsList)

  const buy = async (goodsAddress: string) => {
    const id = toast.loading("Please wait...");
    
    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0];

      const payMasterConfig =
      NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const GoodsContract = new ethers.Contract(
        goodsAddress,
        CommunityGoodsABI,
        new ethers.providers.JsonRpcProvider(
            NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );


      // Encode the calls
      const callTo = [
        goodsAddress
      ];
      const callData = [
        GoodsContract.interface.encodeFunctionData("buy", [
          1,
        ]),

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
    <div >
     
      { loadCommunityListLoading && <Loading></Loading>}
      {!loadCommunityListLoading && (
        <div className={styles.CommunityGoodsList}>
          {goodsList.map((item) => {
            return (
              <div key={item.id} className={styles.CommunityGoods}>
               
                <div className={styles.CommunityGoodsName}>{item.name}</div>
                <div className={styles.CommunityGoodsLogo}>
                <Swiper
                  navigation={true}
                  modules={[Navigation]}
                  className="mySwiper"
                >
                  {item.images.map((item: string) => {
                    return (
                      <SwiperSlide key={item}>
                        <img src={item}></img>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
                </div>
                <div className={styles.CommunityGoodsFooter}>
                <div className={styles.CommunityGoodsPrice}>
                 {item.price} 
                </div>
                <div> </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GoodsList;
