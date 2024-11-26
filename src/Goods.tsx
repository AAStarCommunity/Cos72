/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtom, useAtomValue } from "jotai";
import { TabPanel, TabView } from "primereact/tabview";
import { communityListAtom, Goods, Store } from "./atoms/Community";

import styles from "./Goods.module.css";
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

const CommunityStoreABI = CommunityStore.abi;
const TetherTokenABI = TetherToken.abi;
function GoodsApp() {
  const [communityList, loadCommunityList] = useAtom(communityListAtom);
  const account = useAccount();
  const userInfo = useAtomValue(userInfoAtom);
  const [amountMap, setAmountMap] = useState<any>({});
  const allGoods: Goods[] = [];
  const allStore: Store[] = [];
  communityList.forEach((community) => {
    community.storeList.forEach((store: Store) => {
      allStore.push(store);
      store.goodsList.forEach((goods) => {
        allGoods.push(goods);
      });
    });
  });

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
      <TabView>
        <TabPanel header="All Goods">
          <div className={styles.GoodsList}>
            {allGoods.map((item: Goods) => {
              return (
                <div
                  className={styles.Goods}
                  key={item.uuid}
                >
                  <img src={item.images[0]} className={styles.GoodsImage}></img>
                  <div className={styles.GoodsName}>{item.name}</div>
                  {/* <div className={styles.GoodsPrice}>
                    <div>
                      {item.price} {item.payTokenSymbol}
                    </div>
                  </div> */}
                  <div className={styles.CommunityGoodsPrice}>
                    <div className={styles.GoodsPrice}>
                      {item.price} {item.payTokenSymbol}
                    </div>
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
                        `${
                          item.price * amountMap[item.uuid]
                            ? amountMap[item.uuid]
                            : 1
                        }`,
                        item.payTokenDecimals
                      )
                    ) && (
                      <Button
                        onClick={() => {
                          if (account.connector) {
                            buyByEOA(
                              amountMap[item.uuid] ? amountMap[item.uuid] : 1,
                              item
                            );
                          } else if (userInfo) {
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
                        `${
                          item.price * amountMap[item.uuid]
                            ? amountMap[item.uuid]
                            : 1
                        }`,
                        item.payTokenDecimals
                      )
                    ) && (
                      <Button
                        onClick={() => {
                          if (account && account.connector) {
                            approveByEOA(item);
                          } else if (userInfo) {
                            approve(item);
                          }
                        }}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                  <div className={styles.GoodsStore}>
                    {item.communityName} {item.storeName}
                  </div>
                </div>
              );
            })}
          </div>
        </TabPanel>
        <TabPanel header="Store">
          <div className={styles.StoreList}>
            {allStore.map((store: Store) => {
              return (
                <div className={styles.Store} key={`${store.address}`}>
                  <div className={styles.StoreInfo}>
                    <img src={store.logo} className={styles.StoreImage}></img>
                    <div className={styles.GoodsName}>{store.name}</div>
                  </div>
                  <div className={styles.StoreGoodsList}>
                    {store.goodsList.map((item) => {
                      return (
                        <div
                          className={styles.StoreGoods}
                          key={`${item.storeAddress}-${item.id}`}
                        >
                          <img
                            src={item.images[0]}
                            className={styles.StoreGoodsImage}
                          ></img>

                          <div className={styles.StoreGoodsPrice}>
                            <div>
                              {item.price} {item.payTokenSymbol}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabPanel>
        <TabPanel header="Community"> </TabPanel>
      </TabView>
    </div>
  );
}

export default GoodsApp;
