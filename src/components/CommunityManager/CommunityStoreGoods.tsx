/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Community,
  communityListAtom,
  Goods,
  Store,
} from "../../atoms/Community";
import styles from "./index.module.css";
import { Button } from "primereact/button";
import { DataView } from "primereact/dataview";
import { useAtom, useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { userInfoAtom } from "../../atoms/UserInfo";

import { toast } from "react-toastify";
import { useState } from "react";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityStoreV2JSON from "../../contracts/CommunityStoreV2.json";
import TetherTokenJSON from "../../contracts/TetherToken.json";

import CreateCommunityGoodsDialog from "../CreateCommunityGoodsDialog";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";


import { InputTextarea } from "primereact/inputtextarea";
import { useAccount } from "wagmi";
import { useParams } from "react-router-dom";
import { find } from "lodash";
import { InputText } from "primereact/inputtext";

const CommunityStoreV2ABI = CommunityStoreV2JSON.abi;
const TetherTokenABI = TetherTokenJSON.abi;
function CommunityStoreGoodsManager() {
  const currentChain = useAtomValue(currentChainAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const account = useAccount();
  const [communityList,loadCommunityList] = useAtom(communityListAtom);
  const [goodsValueMap, setGoodsValueMap] = useState<any>({});

  let { address, storeAddress } = useParams();
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
  const [
    isShowCreateCommunityGoodsDialog,
    setIsShowCreateCommunityGoodsDialog,
  ] = useState(false);
  const updateGoodsPayToken = async (goods: Goods, payToken: string) => {
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


      const CommunityStoreV2Contract = new ethers.Contract(
        goods.storeAddress,
        CommunityStoreV2ABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );


  
      // Encode the calls
      const callTo = [
        goods.storeAddress,
      ];
      const callData = [
        CommunityStoreV2Contract.interface.encodeFunctionData("updateGoodsPayToken", [ethers.BigNumber.from(goods.id), payToken])
      ];
      console.log("Waiting for transaction...",callTo, callData, payToken );
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

  const updateGoodsPrice = async (goods: Goods, price: string) => {
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


      const CommunityStoreV2Contract = new ethers.Contract(
        goods.storeAddress,
        CommunityStoreV2ABI,
        new ethers.providers.JsonRpcProvider(
          currentChain.rpc
        )
      );
      let tokenDecimals  = 18;
      if (goods.payToken != ethers.constants.AddressZero) {
        const tokenContract = new ethers.Contract(
          goods.payToken,
          TetherTokenABI,
          new ethers.providers.JsonRpcProvider(currentChain.rpc)
        );
        tokenDecimals = await tokenContract.decimals();
      }

  
      
  
      // Encode the calls
      const callTo = [
        goods.storeAddress,
      ];
      const callData = [
        CommunityStoreV2Contract.interface.encodeFunctionData("updateGoodsPrice", [ethers.BigNumber.from(goods.id), ethers.utils.parseUnits(`${price}`, tokenDecimals)])
      ];
    //  console.log("Waiting for transaction...",callTo, callData, payToken );
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
  const communityGoodsTemplate = (goodsList: Goods[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {goodsList.map((goods: Goods) => {
          return (
            <div
              className={styles.CommunityCard}
              key={goods.uuid}
              onClick={() => {}}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityGoodsImg}>
                <Swiper
                  navigation={true}
                  modules={[Navigation]}
                  className="mySwiper"
                >
                  {goods.images.map((item: string) => {
                    return (
                      <SwiperSlide key={item}>
                        <img src={item}></img>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>

                {/* <img src={store.logo}></img> */}
              </div>
              <div className={styles.CommunityCardInfo}>
                <div className={styles.CommunityGoodsField}>
                  <label>Name: </label>{" "}
                  <InputTextarea cols={40} value={goods.name}></InputTextarea>{" "}
                  <Button>Update</Button>
                </div>
                <div className={styles.CommunityGoodsField}>
                  <label>Description: </label>{" "}
                  <InputTextarea
                    cols={40}
                    value={( goodsValueMap[goods.uuid] && goodsValueMap[goods.uuid].description) ? goodsValueMap[goods.uuid].description : goods.description}
                    onChange={(event) => {
                      setGoodsValueMap((valueMap: any) => {
                        const newData: any = {...valueMap};
                        if (newData[goods.uuid]) {
                          newData[goods.uuid].description = event.target.value;
                        }
                        else {
                          newData[goods.uuid] = {
                            description:  event.target.value
                          }
                        }
                        return newData;
                      })
                    }}
                  ></InputTextarea>{" "}
                  <Button onClick={() => {

                  }}>Update</Button>
                </div>
                <div className={styles.CommunityGoodsField}>
                  <label>Pay Token: </label>{" "}
                  <InputTextarea
                    cols={40}
                    value={( goodsValueMap[goods.uuid] && goodsValueMap[goods.uuid].payToken) ? goodsValueMap[goods.uuid].payToken : goods.payToken} 
                    onChange={(event) => {
                      setGoodsValueMap((valueMap: any) => {
                        const newData: any = {...valueMap};
                        if (newData[goods.uuid]) {
                          newData[goods.uuid].payToken = event.target.value;
                        }
                        else {
                          newData[goods.uuid] = {
                            payToken:  event.target.value
                          }
                        }
                        return newData;
                      })
                    }}  
                  ></InputTextarea>{" "}
                  <Button  onClick={() => {
                    updateGoodsPayToken(goods, ( goodsValueMap[goods.uuid] && goodsValueMap[goods.uuid].payToken) ? goodsValueMap[goods.uuid].payToken : goods.payToken )
                  }}>Update</Button>
                </div>
                <div className={styles.CommunityGoodsField}>
                  <label>Price: </label>{" "}
                  <InputText value={( goodsValueMap[goods.uuid] && goodsValueMap[goods.uuid].price) ? goodsValueMap[goods.uuid].price : goods.price}   onChange={(event) => {
                      setGoodsValueMap((valueMap: any) => {
                        const newData: any = {...valueMap};
                        if (newData[goods.uuid]) {
                          newData[goods.uuid].price = event.target.value;
                        }
                        else {
                          newData[goods.uuid] = {
                            price:  event.target.value
                          }
                        }
                        return newData;
                      })
                    }}  ></InputText>{" "}
                  <Button onClick={() => {
                      updateGoodsPrice(goods, ( goodsValueMap[goods.uuid] && goodsValueMap[goods.uuid].price) ? goodsValueMap[goods.uuid].price : goods.price )
                  }}>Update</Button>
                </div>
              </div>
              <div></div>
            </div>
          );
        })}
      </div>
    );
  };
  const createCommunityStoreGoods = async (currentCommunityStore: Store, communityGoods: any) => {


    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentChain.bundler[0];

      const payMasterConfig = currentChain.paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentChain.rpc, // rpc节点地址,
      });

      const CommunityStoreContract = new ethers.Contract(
        currentCommunityStore?.address,
        CommunityStoreV2ABI,
        new ethers.providers.JsonRpcProvider(currentChain.rpc)
      );


      let tokenDecimals = 18;
      if (communityGoods.payToken !== ethers.constants.AddressZero) {
        const tokenContract = new ethers.Contract(
          communityGoods.payToken,
          TetherTokenABI,
          new ethers.providers.JsonRpcProvider(currentChain.rpc)
        );
        tokenDecimals = await tokenContract.decimals();
      }
      // Encode the calls
      const callTo = [currentCommunityStore.address];
      const goodsData = {
        id: 0,

        name: communityGoods.name,
        description: communityGoods.description,
        images: communityGoods.images.split(","),
        descImages: communityGoods.descImages.split(","),
        payToken: communityGoods.payToken,
        payTokenSymbol: "",
        payTokenDecimals: 0,
        amount: ethers.BigNumber.from(communityGoods.amount),
        price: ethers.utils.parseUnits(communityGoods.price, tokenDecimals),
      };
      console.log(goodsData);
      const callData = [
        CommunityStoreContract.interface.encodeFunctionData("addGoods", [
          goodsData,
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

  const createCommunityStoreGoodsByEOA = async (currentCommunityStore: Store, communityGoods: any) => {

    if (!account.address || !account.connector) {
        return;
    }
    const id = toast.loading("Please wait...");

    //do something else
    try {
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);

      const CommunityStoreContract = new ethers.Contract(
        currentCommunityStore?.address,
        CommunityStoreV2ABI,
        provider.getSigner()
      );
      let tokenDecimals = 18;
      if (communityGoods.payToken !== ethers.constants.AddressZero) {
        const tokenContract = new ethers.Contract(
          communityGoods.payToken,
          TetherTokenABI,
          provider.getSigner()
        );
        tokenDecimals = await tokenContract.decimals();
      }
    
      // Encode the calls
      //const callTo = [currentCommunityStore.address];
      const goodsData = {
        id: 0,

        name: communityGoods.name,
        description: communityGoods.description,
        images: communityGoods.images.split(","),
        descImages: communityGoods.descImages.split(","),
        payToken: communityGoods.payToken,
        payTokenSymbol: "",
        payTokenDecimals: 0,
        amount: ethers.BigNumber.from(communityGoods.amount),
        price: ethers.utils.parseUnits(communityGoods.price, tokenDecimals),
      };
      console.log(goodsData);
      // const callData = [
      //   CommunityStoreContract.interface.encodeFunctionData("addGoods", [
      //     goodsData,
      //   ]),
      // ];
      console.log("Waiting for transaction...");

      console.log("Waiting for transaction...");

      const transactionObject = await CommunityStoreContract.addGoods(goodsData);
   //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash)
    
      console.log(`Transaction hash: ${transactionObject.hash}`);
      // // 第三步 发送 UserOperation
      // const response = await smartAccount.sendUserOperation(callTo, callData);


      // console.log(`Transaction hash: ${response.transactionHash}`);
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
            label="Add Goods"
            className={styles.mintUSDTBtn}
            onClick={() => {
              setIsShowCreateCommunityGoodsDialog(true);
            }}
          />
        </div>
        {currentCommunityStore && (
          <DataView
            className={styles.CommunityDataView}
            value={currentCommunityStore.goodsList}
            listTemplate={communityGoodsTemplate as any}
          ></DataView>
        )}
      </div>
      <CreateCommunityGoodsDialog
        visible={isShowCreateCommunityGoodsDialog}
        onHide={() => {
          setIsShowCreateCommunityGoodsDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          if (currentCommunityStore) {
            if (account.connector) {
              await createCommunityStoreGoodsByEOA(currentCommunityStore, data);
            }
            else if (userInfo) {
              await createCommunityStoreGoods(currentCommunityStore, data);
            }
           
            callback();
            setIsShowCreateCommunityGoodsDialog(false);
          }
        }}
      ></CreateCommunityGoodsDialog>
    </>
  );
}

export default CommunityStoreGoodsManager;
