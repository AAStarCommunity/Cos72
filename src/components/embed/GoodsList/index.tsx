/* eslint-disable @typescript-eslint/no-explicit-any */

import styles from "./index.module.css";
import { useState } from "react";

import { ethers } from "ethers";

import { NetworkdConfig, networkIds } from "../../../config";


import CommunityStore from "../../../contracts/CommunityStore.json";
import TetherToken from "../../../contracts/TetherToken.json";

import { Button } from "primereact/button";
import { AAStarClient } from "../../../sdk";
import { useAtom, useAtomValue } from "jotai";
import {
  communityListAtom,
  Goods,
  loadCommunityListLoadingAtom,
} from "../../../atoms/Community";

const CommunityStoreABI = CommunityStore.abi;
const TetherTokenABI = TetherToken.abi;
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import { InputNumber } from "primereact/inputnumber";
import { BlockUI } from "primereact/blockui";
import PacmanLoader from "react-spinners/PacmanLoader";
import { useAccount } from "wagmi";
import { userInfoAtom } from "../../../atoms/UserInfo";
interface AccountSignDialogParams {}

function GoodsList({}: AccountSignDialogParams) {
  const [communityList, loadCommunityList] = useAtom(communityListAtom);
  const [amountMap, setAmountMap] = useState<any>({});
  const userInfo = useAtomValue(userInfoAtom);
  const account = useAccount();
  const loadCommunityListLoading = useAtomValue(loadCommunityListLoadingAtom);
  const [actionLoading, setActionLoading] = useState(false);
  const goodsList: Goods[] = [];
  communityList.forEach((community) => {
    community.storeList.forEach((store) => {
      store.goodsList.forEach((goods) => {
        goodsList.push(goods);
      });
    });
  });
  console.log(goodsList);

  const buy = async (amount: number, goods: Goods) => {
   
    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      setActionLoading(true);
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
        goods.storeAddress,
        CommunityStoreABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );

      // Encode the calls
      const callTo = [goods.storeAddress];
      console.log(goods.id, goods.storeAddress, amount)
      const callData = [GoodsContract.interface.encodeFunctionData("buy", [goods.id, amount])];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      
    } catch (error) {
      console.log(error);
  
    }
    setActionLoading(false);
  };

  const buyByEOA = async (amount: number, goods: Goods) => {
    if (!account.address || !account.connector) {
      return;
    }
    //do something else
    try {
      //     const wallet = getWallet();
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);
      // 第一步 创建 AAStarClient
      setActionLoading(true);
 

      // 第二步 创建合约调用参数
      const GoodsContract = new ethers.Contract(
        goods.storeAddress,
        CommunityStoreABI,
        provider.getSigner()
      );

   
      const transactionObject = await GoodsContract.buy(goods.id, amount);
      //   return transactionObject.hash;
         // 第三步 发送 UserOperation
         await provider.waitForTransaction(transactionObject.hash)
         await loadCommunityList(account.address);
      
    } catch (error) {
      console.log(error);
  
    }
    setActionLoading(false);
  };

  const approve = async ( goods: Goods) => {
    //const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      setActionLoading(true);
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
        goods.payToken,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
    

      // Encode the calls
      const callTo = [goods.payToken];
      const callData = [GoodsContract.interface.encodeFunctionData("approve", [goods.storeAddress, ethers.constants.MaxUint256])];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      await loadCommunityList((userInfo as any).aa);
      // console.log(`Transaction hash: ${response.transactionHash}`);
      // toast.update(id, {
      //   render: "Success",
      //   type: "success",
      //   isLoading: false,
      //   autoClose: 5000,
      // });
    } catch (error) {
      console.log(error);
      // toast.update(id, {
      //   render: "Transaction Fail",
      //   type: "error",
      //   isLoading: false,
      //   autoClose: 5000,
      // });
    }
    setActionLoading(false);
  };

  const approveByEOA = async ( goods: Goods) => {
    //const id = toast.loading("Please wait...");
    if (!account.address || !account.connector) {
      return;
    }
    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      setActionLoading(true);
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);


      // 第二步 创建合约调用参数
      const GoodsContract = new ethers.Contract(
        goods.payToken,
        TetherTokenABI,
        provider.getSigner()
      );
     

      // Encode the calls
    
      const transactionObject = await GoodsContract.approve(goods.storeAddress, ethers.constants.MaxUint256);
   //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash)
      await loadCommunityList(account.address);
      // console.log(`Transaction hash: ${response.transactionHash}`);
      // toast.update(id, {
      //   render: "Success",
      //   type: "success",
      //   isLoading: false,
      //   autoClose: 5000,
      // });
    } catch (error) {
      console.log(error);
      // toast.update(id, {
      //   render: "Transaction Fail",
      //   type: "error",
      //   isLoading: false,
      //   autoClose: 5000,
      // });
    }
    setActionLoading(false);
  };



  return (
    <div>
     
   
        <BlockUI blocked={loadCommunityListLoading || actionLoading} template={
            <div><PacmanLoader color='#2dd4bf'  size={20}/> </div>
        }>
          <div className={styles.CommunityGoodsListWrapper}>
        <div className={styles.CommunityGoodsList}>
          {goodsList.map((item) => {
            return (
              <div key={item.uuid} className={styles.CommunityGoods}>
                <div>
                  <div className={styles.CommunityGoodsHeader}>
                    <div className={styles.CommunityGoodsName}>{item.name}</div>
                    <div className={styles.CommunityGoodsLogo}>
                      {" "}
                      {item.storeName}
                    </div>
                  </div>
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
                    <div>{item.price} {item.payTokenSymbol}</div>
                    <div>Balance: {item.fixedFormatPayTokenBalance}</div>
                  </div>
                  <div className={styles.actionButtons}>
                    <InputNumber
                      className={styles.numberInput}
                      value={amountMap[item.uuid] ? amountMap[item.uuid] : 1}
                      size={2}
                      mode="decimal"
                      showButtons
                      min={1}
                      max={100}
                      onValueChange={(e) => {
                        setAmountMap((data: any) => {
                          const newData = { ...data };
                          newData[item.uuid] = e.value;
                          return newData;
                        });
                      }}
                    />
                    {item.buyAllowance.gte(
                      ethers.utils.parseUnits(
                        `${item.price * amountMap[item.uuid] ? amountMap[item.uuid] : 1}`,
                      item.payTokenDecimals)
                    ) && (
                      <Button
                        onClick={() => {
                          if (account.connector) {
                            buyByEOA(
                              amountMap[item.uuid] ? amountMap[item.uuid] : 1,
                              item
                            );
                          }
                          else if (userInfo) {
                            buy(
                              amountMap[item.uuid] ? amountMap[item.uuid] : 1,
                              item
                            );
                          }
                        
                        }}
                      >
                        Buy
                      </Button>
                    )}
                       {item.buyAllowance.lt(
                      ethers.utils.parseUnits(
                        `${item.price * amountMap[item.uuid] ? amountMap[item.uuid] : 1}`,
                      item.payTokenDecimals)
                    ) && (
                      <Button
                        onClick={() => {
                          if (account && account.connector) {
                            approveByEOA(item);
                          }
                          else if (userInfo) {
                            approve(
                           
                              item
                            );
                          }
                         
                        }}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </BlockUI>
      
    </div>
  );
}

export default GoodsList;
