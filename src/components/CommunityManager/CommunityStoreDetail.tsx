/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chip } from "primereact/chip";
import {
  Community,
  communityListAtom,
  Store,
} from "../../atoms/Community";
import styles from "./CommunityStoreDetail.module.css";
import { Button } from "primereact/button";
import { useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import { toast } from "react-toastify";
import { TabPanel, TabView } from "primereact/tabview";
import CommunityStoreGoodsManager from "./CommunityStoreGoods";
import { AAStarClient } from "../../sdk";
import { ethers } from "ethers";
import CommunityStoreJSON from "../../contracts/CommunityStore.json";
import { useParams } from "react-router-dom";
import { find } from "lodash";
import { Panel } from "primereact/panel";
import { useAccount } from "wagmi";
import { userInfoAtom } from "../../atoms/UserInfo";
const CommunityStoreABI = CommunityStoreJSON.abi;
function CommunityStoreDetail() {
  const currentChain = useAtomValue(currentChainAtom);
  const communityList = useAtomValue(communityListAtom);
  let { address, storeAddress } = useParams();
  const account = useAccount();
  const userInfo = useAtomValue(userInfoAtom);
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
  const updateCommunityContract = async () => {
    if (!currentCommunityStore) {
      return;
    }

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
        CommunityStoreABI,
        new ethers.providers.JsonRpcProvider(currentChain.rpc)
      );

      // Encode the calls
      const callTo = [currentCommunityStore.address];

      const callData = [
        CommunityStoreContract.interface.encodeFunctionData("upgrade", [
          currentChain.contracts.CommunityStoreV3,
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

  const updateCommunityContractByEOA = async () => {
    if (!currentCommunityStore) {
      return;
    }

    if (!account.address || !account.connector) {
      return;
    }
    const id = toast.loading("Please wait...");


    //do something else
    try {
      //     const wallet = getWallet();
      const _provider: any = await account.connector.getProvider();
      const provider = new ethers.providers.Web3Provider(_provider);



      const CommunityStoreContract = new ethers.Contract(
        currentCommunityStore?.address,
        CommunityStoreABI,
        provider
      );


      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation

      const transactionObject = await CommunityStoreContract.upgrade(
        currentChain.contracts.CommunityStoreV3
      );
      //   return transactionObject.hash;
      // 第三步 发送 UserOperation
      await provider.waitForTransaction(transactionObject.hash);
     // await loadCommunityList(account.address);
      console.log(`Transaction hash: ${transactionObject.hash}`);
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

  if (!currentCommunityStore || !currentCommunity) {
    return null;
  }
  return (
    <>
      <Panel header={currentCommunityStore.name}>
        <div>{currentCommunityStore.description}</div>
        <div className={styles.communityContractAction}>
          <Chip
            className={styles.CommunityCardContractAddress}
            onClick={() => {
              window.open(
                `${currentChain.blockExplorerURL}/address/${currentCommunityStore.address}`,
                "_blank"
              );
            }}
            label={`Contract ${currentCommunityStore.address}`}
          ></Chip>{" "}
          Contract Version : V{currentCommunityStore.version}{" "}
          {
            currentCommunityStore.version < 3 &&  <Button
            onClick={() => {
              updateCommunityContract();
              if (account.connector) {
                updateCommunityContractByEOA()
              }
              else if (userInfo) {
                updateCommunityContract();
              }
            }}
            disabled={!currentCommunity.isAdmin}
            size="small"
          >
            Update Store Contract To V3
          </Button>
          }
         
        </div>
        <TabView>
          <TabPanel header="Goods">
            <CommunityStoreGoodsManager></CommunityStoreGoodsManager>
          </TabPanel>
        </TabView>
      </Panel>
    </>
  );
}

export default CommunityStoreDetail;
