/* eslint-disable @typescript-eslint/no-explicit-any */

import { Panel } from "primereact/panel";
import styles from "./Tutorial.module.css";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useEffect, useRef, useState } from "react";
import { CopyBlock, nord } from "react-code-blocks";
import { toast, ToastContainer } from "react-toastify";
import { AAStarClient } from "./sdk";
import { NetworkdConfig, networkIds } from "./config";
import { ethers } from "ethers";
import { Stepper } from 'primereact/stepper';
import { StepperPanel } from 'primereact/stepperpanel';
import TetherToken from "./contracts/TetherToken.json";
import { Fieldset } from "primereact/fieldset";
import { InputTextarea } from "primereact/inputtextarea";
import { isAddress } from "ethers/lib/utils";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chip } from "primereact/chip";
import { TabPanel, TabView } from "primereact/tabview";
import PaymasterTutorial from "./tutorial/Paymaster";
import AirAccountTutorial from "./tutorial/AirAccount";

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}
const TetherTokenABI = TetherToken.abi;
function App() {
  const stepperRef = useRef(null);
  const [bundlerUrl, setBundlerUrl] = useState(undefined);
  const [paymasterUrl, setPaymasterUrl] = useState(undefined);
  const [paymasterStrategyCode, setPaymasterStrategyCode] = useState(null);
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);


  const updateUSDTBalance = async () => {
    if (account && isAddress(account)) {
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(NetworkdConfig[networkIds.OP_SEPOLIA].rpc)
      );
      TestnetERC20.balanceOf(account).then((value: ethers.BigNumber) => {
        setTokenBalance(ethers.utils.formatUnits(value, 6) as any);
      });
    }
    else {
      setTokenBalance(0)
    }
  };
  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
    try {
      const smartAccount = new AAStarClient({
        aaConfig: {
          provider: "SimpleAccount"
        },
        bundler: {
          provider: "pimlico",
          config: {
            url: bundlerUrl  as any         
          }
        },
        paymaster:  {
          provider: "aastar",
          config: {
            url:  paymasterUrl as any,
            option: {
              strategy_code: paymasterStrategyCode as any,
              version: "v0.6",
            },
          },
        },

        rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc,
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
      await updateUSDTBalance();
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
     
      
      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TutorialTransactionLogs", JSON.stringify(newItems));
        return newItems;
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
  };

  const TransactionLog = (log: TransactionLog) => {
    return (
      <a
        href={`${NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL}/tx/${log.transactionHash}`}
        target="_blank"
      >
        {log.transactionHash}
      </a>
    );
  };

  useEffect(() => {
    updateUSDTBalance()
  }, [account])

  useEffect(() => {
    const TransactionLogs = localStorage.getItem("TutorialTransactionLogs");
    if (TransactionLogs) {
      setTransactionLogs(JSON.parse(TransactionLogs));
    }
  }, []);


  return (
   <>
     <TabView>
      <TabPanel header={"Mint Token with Paymaster and SimpleAccount"}>
          <PaymasterTutorial></PaymasterTutorial>
      </TabPanel>
      <TabPanel header={"Mint Token with Paymaster and AirAccount"}>
         <AirAccountTutorial></AirAccountTutorial>

      </TabPanel>
     </TabView>
     
    
      <ToastContainer />
      </>
   
  );
}

export default App;
