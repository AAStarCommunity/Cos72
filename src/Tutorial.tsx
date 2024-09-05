/* eslint-disable @typescript-eslint/no-explicit-any */

import { Panel } from "primereact/panel";
import styles from "./Tutorial.module.css";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useState } from "react";
import { CopyBlock, nord } from "react-code-blocks";
import { toast, ToastContainer } from "react-toastify";
import { AAStarClient } from "./sdk";
import { NetworkdConfig, networkIds } from "./config";
import { ethers } from "ethers";
import TetherToken from "./contracts/TetherToken.json";
const TetherTokenABI = TetherToken.abi;
function App() {
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState(null);
  const [mintLoading, setMintLoading] = useState(false);
  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
    try {

      // 第一步 创建 AAStarClient
      const bundlerConfig = NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0];

      const payMasterConfig = NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider( NetworkdConfig[networkIds.OP_SEPOLIA].rpc)
      );
      // Encode the calls
      const callTo = [ NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          account,
          ethers.utils.parseUnits(amount as any, 6),
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
    setMintLoading(false);
  };
  return (
    <div className={styles.Root}>
      <div className={styles.DemoPanel}>
        <Panel header="Mint Test Token Demo">
          <div className={styles.inputRow}>
            <div>Account</div>
            <InputText
              value={account}
              className={styles.input}
              onChange={(event) => {
                setAccount(event.target.value as any);
              }}
            ></InputText>
          </div>
          <div className={styles.inputRow}>
            <div>Amount</div>
            <InputText
              value={amount}
              className={styles.input}
              onChange={(event) => {
                setAmount(event.target.value as any);
              }}
            ></InputText>
          </div>

          <Button label="Mint" loading={mintLoading} onClick={() => {
            mintUSDT();
          }}></Button>
        </Panel>
      </div>
      <div className={styles.SourcePanel}>
        <Panel header="Source">
        <CopyBlock
            showLineNumbers={true}
            theme={nord}
            text={`  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
    try {

      // 第一步 创建 AAStarClient
      const bundlerConfig = NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0];

      const payMasterConfig = NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider( NetworkdConfig[networkIds.OP_SEPOLIA].rpc)
      );
      // Encode the calls
      const callTo = [ NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          account,
          ethers.utils.parseUnits(amount as any, 6),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
    
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
    setMintLoading(false);
  };`}
            language="typescript"
          />
        </Panel>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
