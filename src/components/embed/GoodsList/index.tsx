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
const CommunityABI = Community.abi;
const CommunityGoodsABI = CommunityGoods.abi;
const TetherTokenABI = TetherToken.abi;

interface AccountSignDialogParams {
  communityAddress: string;
  account: string;
}
interface Community {
  name: string;
  address: string;
  desc: string;
  logo: string;

  goodsList: {
    name: string;
    description: string;
    logo: string;
    payToken: string;
    address: string;
    receiver: string;
    price: string;
    amount: string;
    payTokenSymbol: string;
    isCanBuy: boolean;
  }[];
}
function GoodsList({ communityAddress, account}: AccountSignDialogParams) {

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(false);
  const loadGoodsList = async (communityAddress: string) => {
    setLoading(true);
    const provider = MulticallWrapper.wrap(
      new ethers.providers.JsonRpcProvider(
        NetworkdConfig[networkIds.OP_SEPOLIA].rpc
      )
    );
    const community = new ethers.Contract(
      communityAddress,
      CommunityABI,
      provider
    );
    const [name, desc, logo, goodsAddressList] = await Promise.all([
      community.name(),
      community.description(),
      community.logo(),

      community.getGoodsList(),
    ]);

    const goodsList = [];
    for (let m = 0, n = goodsAddressList.length; m < n; m++) {
      const communityGoods = new ethers.Contract(
        goodsAddressList[m],
        CommunityGoodsABI,
        provider
      );
      const setting = await communityGoods.setting();
      const payTokenContract = new ethers.Contract(
        setting.payToken,
        TetherTokenABI,
        provider
      );
      const [decimals, symbol, buyAllowance] = await Promise.all([
        payTokenContract.decimals(),
        payTokenContract.symbol(),
        payTokenContract.allowance(account, setting.payToken)
      ]);

      goodsList.push({
        address: goodsAddressList[m],
        name: setting.name,
        description: setting.description,
        logo: setting.logo,
        payToken: setting.payToken,
        receiver: setting.receiver,
        price: ethers.utils.formatUnits(setting.price, decimals),
        payTokenSymbol: symbol,
        amount: setting.amount,
        isCanBuy: buyAllowance.gt(setting.price)
      });
    }
    setCommunity({
      address: communityAddress,
      name,
      logo,
      desc,
      goodsList,
    });
    setLoading(false);
  };
  useEffect(() => {
    loadGoodsList(communityAddress);
  }, []);

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
     
      {loading && <Loading></Loading>}
      {(community && !loading) && (
        <div className={styles.CommunityGoodsList}>
          {community.goodsList.map((item) => {
            return (
              <div key={item.address} className={styles.CommunityGoods}>
               
                <div className={styles.CommunityGoodsName}>{item.name}</div>
                <div className={styles.CommunityGoodsLogo}>
                  <img src={item.logo} />
                </div>
                <div className={styles.CommunityGoodsFooter}>
                <div className={styles.CommunityGoodsPrice}>
                 {item.price} {item.payTokenSymbol}
                </div>
                <div> <Button disabled={!item.isCanBuy} icon="pi pi-shopping-cart"  rounded  size="small" onClick={() => {
                    buy(item.address);
                }}/> <Button disabled={!item.isCanBuy} icon="pi pi-shopping-cart"  rounded  size="small" onClick={() => {
                    buy(item.address);
                }}/></div>
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
