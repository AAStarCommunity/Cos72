/* eslint-disable @typescript-eslint/no-explicit-any */

import { Panel } from "primereact/panel";
import styles from "./AirAccount.module.css";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useEffect, useRef, useState } from "react";
import { CopyBlock, nord } from "react-code-blocks";
import { toast, ToastContainer } from "react-toastify";
import { AAStarClient } from "../sdk";
import { NetworkdConfig, networkIds } from "../config";
import { ethers } from "ethers";
import { Stepper } from 'primereact/stepper';
import { StepperPanel } from 'primereact/stepperpanel';
import TetherToken from "../contracts/TetherToken.json";
import { Fieldset } from "primereact/fieldset";
import { InputTextarea } from "primereact/inputtextarea";
import { isAddress } from "ethers/lib/utils";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chip } from "primereact/chip";

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}
const TetherTokenABI = TetherToken.abi;
function AirAccountTutorial() {
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
      <div className={styles.Root}>
      <div className={styles.DemoPanel}>
        <div>
          <Fieldset legend="Config" className={styles.Config} toggleable>
          <div className={styles.inputRow}>
            <div>Bundler Url</div>
            <InputTextarea
              value={bundlerUrl}
              className={styles.input}
              onChange={(event) => {
                setBundlerUrl(event.target.value as any);
              }}
            ></InputTextarea>
          </div>
          <div className={styles.inputRow}>
            <div>Paymaster Url</div>
            <InputTextarea
              value={paymasterUrl}
              className={styles.input}
              onChange={(event) => {
                setPaymasterUrl(event.target.value as any);
              }}
            ></InputTextarea>
          </div>
          <div className={styles.inputRow}>
            <div>Paymaster Strategy Code</div>
            <InputText
              value={paymasterStrategyCode}
              className={styles.input}
              onChange={(event) => {
                setPaymasterStrategyCode(event.target.value as any);
              }}
            ></InputText>
          </div>
          </Fieldset>
          <Chip
                className={styles.ContractAddress}
                onClick={() => {
                  window.open(
                    `${NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL}/address/${NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT}`,
                    "_blank"
                  );
                }}
                label={`Test Token Contract ${NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT}`}
              ></Chip>
          <div className={styles.inputRow}>
            <div className={styles.tokenInfo}><div>Account</div> <div>Balance: {tokenBalance}</div></div>
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
          <div className={styles.DataTable}>
          <DataTable
              value={transactionLogs}
              
              showGridlines
            >
              {/* <Column field="userOpHash" header="User Op Hash"></Column> */}
              <Column
                field="transactionHash"
                header="Transaction Hash"
                body={TransactionLog}
              ></Column>
            </DataTable>
          </div>
        </div>
      </div>
      <div className={styles.SourcePanel}>
        <Panel header="Tutorial">
        <Stepper ref={stepperRef}  orientation="vertical">
                <StepperPanel header="Apply Bundler">
                    <div>Apply for API Key at <a href="https://dashboard.pimlico.io/apikeys" target="_blank">https://dashboard.pimlico.io/apikeys</a>. Please select OP Sepolia for the network and fill in the applied RPC URL into the Bundler Url input box on the left.</div>
                </StepperPanel>
                <StepperPanel header="Apply Paymaster">
                  <ol>
                    <li> <div>Apply for API Key at <a href="https://dashboard.aastar.io/api-keys" target="_blank">https://dashboard.aastar.io/api-keys</a>. Please select OP Sepolia for the network and fill in the applied RPC URL into the Paymaster Url input box on the left.</div></li>
                    <li>      
                    <div>Create Strategy at <a href="https://dashboard.aastar.io/strategy/create" target="_blank">https://dashboard.aastar.io/strategy/create</a>. Copy the strategy code into the left Strategy code input box.</div></li>
                  </ol>
         
                </StepperPanel>
                <StepperPanel header="Code">
                <CopyBlock
            showLineNumbers={true}
            theme={nord}
            text={` const mintUSDT = async () => {
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
                
                </StepperPanel>
            </Stepper>
      
        </Panel>
      </div>
      </div>
    
      <ToastContainer />
      </>
   
  );
}

export default AirAccountTutorial;
