/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtom, useAtomValue } from "jotai";

import { Community, communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./GoodsDetail.module.css";
import { InputNumber } from "primereact/inputnumber";
import { ethers } from "ethers";
import { Button } from "primereact/button";
import { useAccount } from "wagmi";
import { AAStarClient } from "./sdk";
import { NetworkdConfig, networkIds } from "./config";
import CommunityStore from "./contracts/CommunityStoreV2.json";
import TetherToken from "./contracts/TetherToken.json";
import { userInfoAtom } from "./atoms/UserInfo";
import { useState } from "react";
import { toast } from "react-toastify";
import { useParams } from "react-router-dom";
import { find } from "lodash";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import StoreInfo from "./components/StoreInfo";
const CommunityStoreABI = CommunityStore.abi;
const TetherTokenABI = TetherToken.abi;
function GoodsDetail() {
  const [communityList, loadCommunityList] = useAtom(communityListAtom);
  let { address, storeAddress, goodsId } = useParams();
  const account = useAccount();
  const userInfo = useAtomValue(userInfoAtom);
  const [goodsAmount, setGoodsAmount] = useState<any>(1);
//   const [isApprove, setIsApprove] = useState(false);
//   const [isBuy, setIsBuy] = useState(false);
//   const account = useAccount();
//   const userInfo = useAtomValue(userInfoAtom);
  const currentCommunity = find(communityList, (item: Community) => {
    return item.address === address;
  });
  if (!currentCommunity) {
    return null;
  }

  const currentCommunityStore = find(
    currentCommunity.storeList,
    (item: Store) => {
      return item.address === storeAddress;
    }
  );

  if (!currentCommunityStore) {
    return null;
  }
  const currentGoods = find(
    currentCommunityStore.goodsList,
    (item: Goods) => {
      return item.id.toNumber() === Number(goodsId);
    }
  );

  if (!currentGoods) {
    return null;
  }

  let currentTotalAmount = ethers.constants.Zero;
 try {
    currentTotalAmount =   ethers.utils.parseUnits(
        `${
            currentGoods.price * goodsAmount
        }`,
        currentGoods.payTokenDecimals
      )
 }
 catch(error) {

 }





  const buy = async (amount: number, goods: Goods) => {
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
        goods.storeAddress,
        CommunityStoreABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );

      // Encode the calls
      const callTo = [goods.storeAddress];
      console.log(goods.id, goods.storeAddress, amount);
      const callData = [
        GoodsContract.interface.encodeFunctionData("buy", [goods.id, amount]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
    } catch (error) {
      console.log(error);
    }
  };

  const buyByEOA = async (amount: number, goods: Goods) => {
    if (!account.address || !account.connector) {
      return;
    }
    const id = toast.loading("Please wait...");
    //do something else
    try {
      //     const wallet = getWallet();
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);
      // 第一步 创建 AAStarClient

      // 第二步 创建合约调用参数
      const GoodsContract = new ethers.Contract(
        goods.storeAddress,
        CommunityStoreABI,
        provider.getSigner()
      );
      let transactionObject; 
      if (goods.payToken === ethers.constants.AddressZero) {
        transactionObject = await GoodsContract.buy(goods.id, amount, {
            value: ethers.utils.parseEther(`${goods.price}`).mul(amount)
        });
      }
      else {
        transactionObject = await GoodsContract.buy(goods.id, amount);
      }
     
      //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityList(account.address);
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

  const approve = async (goods: Goods) => {
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
        goods.payToken,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );

      // Encode the calls
      const callTo = [goods.payToken];
      const callData = [
        GoodsContract.interface.encodeFunctionData("approve", [
          goods.storeAddress,
          ethers.constants.MaxUint256,
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      await loadCommunityList((userInfo as any).aa);
      // console.log(`Transaction hash: ${response.transactionHash}`);
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

  const approveByEOA = async (goods: Goods) => {
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

      // 第二步 创建合约调用参数
      const GoodsContract = new ethers.Contract(
        goods.payToken,
        TetherTokenABI,
        provider.getSigner()
      );

      // Encode the calls

      const transactionObject = await GoodsContract.approve(
        goods.storeAddress,
        ethers.constants.MaxUint256
      );
      //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash);
      await loadCommunityList(account.address);
      // console.log(`Transaction hash: ${response.transactionHash}`);
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
    <div className={styles.Root}>
       <StoreInfo data={currentCommunityStore} isShowEnter={true}></StoreInfo>
      
       <div className={styles.goodsInfo}>
            <div className={styles.goodsImage}>
            <Swiper
                  navigation={true}
                  modules={[Navigation]}
                className={styles.Swiper}
                >
                  {currentGoods.images.map((item: string) => {
                    return (
                      <SwiperSlide key={item}>
                        <img src={item} className={styles.goodsItemImage}></img>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
            </div>
            <div className={styles.goodsText}>
                <div className={styles.goodsName}>{currentGoods.name}</div>
                <div className={styles.goodsDesc}>{currentGoods.description}</div>
                <div className={styles.goodsBuyInfo}>
                <div className={styles.goodsPrice}>
                    <div className={styles.goodsTokenPrice}>
                      {currentGoods.price} {currentGoods.payTokenSymbol}
                    </div>
                    <div className={styles.balance}>Balance: {currentGoods.fixedFormatPayTokenBalance}</div> 
                  </div> 
                  {/* <a href="https://faucet.circle.com/">GET USDC</a> */}
                    <div className={styles.actionButtons}>
                    <InputNumber
                      className={styles.numberInput}
                      value={goodsAmount}
                      size={2}
                      mode="decimal"
                      showButtons
                      min={1}
                      max={10000}
                      onValueChange={(e) => {
                        console.log(e.value)
                        setGoodsAmount(e.value)
                      }}
                    />
                    {currentGoods.buyAllowance.gte(currentTotalAmount) && currentGoods.payTokenBalance.gte(currentTotalAmount) && (
                      <Button className={styles.button} label="Buy"
                        onClick={() => {
                          if (account.connector) {
                            buyByEOA(
                                goodsAmount,
                              currentGoods
                            );
                          } else if (userInfo) {
                            buy(
                                goodsAmount,
                                currentGoods
                            );
                          }
                        }}
                      >
                      </Button>
                    )}
                    {currentGoods.buyAllowance.gte(
                     currentTotalAmount) && currentGoods.payTokenBalance.lt(currentTotalAmount) && (
                      <Button className={styles.button} label="Insufficient Balance"
                         disabled
                      >
                      </Button>
                    )}
                    {currentGoods.buyAllowance.lt(currentTotalAmount) && (
                      <Button 
                       label="Approve"
                       className={styles.button}
                        onClick={() => {
                          if (account && account.connector) {
                            approveByEOA(currentGoods);
                          } else if (userInfo) {
                            approve(currentGoods);
                          }
                        }}
                      >
                        
                      </Button>
                    )}
                  </div> 
                </div>
            </div>
       

       </div>
    </div>
  );
}

export default GoodsDetail;
