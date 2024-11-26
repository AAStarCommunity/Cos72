/* eslint-disable @typescript-eslint/no-explicit-any */

import { Panel } from "primereact/panel";
import styles from "./Setting.module.css";
import { Card } from "primereact/card";
import { Chip } from "primereact/chip";
import { useAtomValue } from "jotai";
import { currentChainAtom } from "./atoms/CurrentChain";
import { Button } from "primereact/button";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import CommunityStoreV3 from "./contracts/CommunityStoreV3.json";
import CommunityManager from "./contracts/CommunityManager.json";
function Setting() {
  const currentChain = useAtomValue(currentChainAtom);
  const account = useAccount();
  const deployCommunityManagerByEOA = async () => {
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

      const factory = new ethers.ContractFactory(
        CommunityManager.abi,
        CommunityManager.bytecode,
        provider.getSigner()
      );
      const address = await provider.getSigner().getAddress();

      const contract = await factory.deploy(address);
      console.log(contract);

      await contract.deployTransaction.wait();
      console.log(contract.address);

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
  const deployCommunityStoreV3ByEOA = async () => {
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

      const factory = new ethers.ContractFactory(
        CommunityStoreV3.abi,
        CommunityStoreV3.bytecode,
        provider.getSigner()
      );
      //    const address = await provider.getSigner().getAddress()

      const contract = await factory.deploy();
      console.log(contract);

      await contract.deployTransaction.wait();
      console.log(contract.address);

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
      <Panel header="Setting">
        <div className={styles.ContractList}>
          <Card title="CommunityManager">
            <div className={styles.ContractSetting}>
              Contract Address:{" "}
              <Chip
                className={styles.CommunityCardContractAddress}
                onClick={() => {
                  window.open(
                    `${currentChain.blockExplorerURL}/address/${currentChain.contracts.CommunityManager}`,
                    "_blank"
                  );
                }}
                label={`${currentChain.contracts.CommunityManager}`}
              ></Chip>
              <Button
                onClick={() => {
                  deployCommunityManagerByEOA();
                }}
              >
                Deploy CommunityManager
              </Button>
            </div>
          </Card>
          <Card title="CommunityStore V3">
            <div className={styles.ContractSetting}>
              Contract Address:{" "}
              <Chip
                className={styles.CommunityCardContractAddress}
                onClick={() => {
                  window.open(
                    `${currentChain.blockExplorerURL}/address/${currentChain.contracts.CommunityStoreV3}`,
                    "_blank"
                  );
                }}
                label={`${currentChain.contracts.CommunityStoreV3}`}
              ></Chip>
              <Button
                onClick={() => {
                  deployCommunityStoreV3ByEOA();
                }}
              >
                Deploy CommunityStore V3
              </Button>
            </div>
          </Card>
        </div>
      </Panel>
    </div>
  );
}

export default Setting;
