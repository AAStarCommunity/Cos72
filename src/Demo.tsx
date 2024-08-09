/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import TetherToken from "./contracts/TetherToken.json";
import styles from "./Demo.module.css";
import "react-toastify/dist/ReactToastify.css";

import { LoadingButton } from "@mui/lab";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import _, { find } from "lodash";

import { ToastContainer, toast } from "react-toastify";

import { AAStarClient } from "./sdk";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { NetworkdConfig, NetworkId } from "./config";

const TetherTokenABI = TetherToken.abi;

const getWallet = () => {
  const signingKey = localStorage.getItem("signingKey");
  let signer: ethers.Wallet | null = null;
  if (signingKey) {
    signer = new ethers.Wallet(signingKey);
  } else {
    signer = ethers.Wallet.createRandom();
    localStorage.setItem("signingKey", signer.privateKey);
  }
  return signer;
};

// const getSimpleAccount = (
//   wallet: ethers.Wallet,
//   paymasterUrl: string
// ) => {
//   const accountAPI = new SimpleAccountAPI({
//     provider: new ethers.providers.JsonRpcProvider(ethereumSepoliaRpcUrl),
//     entryPointAddress,
//     owner: wallet,
//     factoryAddress,
//     paymasterAPI:
//       paymasterUrl.indexOf("aastar") >= 0
//         ? new AAStarPayMasterAPI(paymasterUrl, entryPointAddress)
//         : paymasterUrl.indexOf("pimlico") >= 0
//         ? new PimlicoPayMasterAPI(paymasterUrl, entryPointAddress)
//         : paymasterUrl.indexOf("biconomy") >= 0
//         ? new BiconomyPayMasterAPI(paymasterUrl, entryPointAddress)
//         : new StackupPayMasterAPI(paymasterUrl, entryPointAddress),
//   });
//   return accountAPI;
// };
interface MintItem {
  account: string;
  amount: string | null;
  balance: string | null;
  loading?: boolean;
  mintBtnText: string;
}

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}
// function getPayMasterConfig(url: string) {
//   const config: PaymasterConfig = {
//     provider:
//       url.indexOf("aastar") >= 0
//         ? "aastar"
//         : url.indexOf("pimlico") >= 0
//         ? "pimlico"
//         : url.indexOf("biconomy") >= 0
//         ? "biconomy"
//         : "stackup",
//     config: {
//       url: url,
//     },
//   };
//   return config;
// }

// function getBundlerConfig(url: string) {
//   const config: BundlerConfig = {
//     provider:
//       url.indexOf("aastar") >= 0
//         ? "aastar"
//         : url.indexOf("pimlico") >= 0
//         ? "pimlico"
//         : url.indexOf("biconomy") >= 0
//         ? "biconomy"
//         : "stackup",
//     config: {
//       url: url,
//     },
//   };
//   return config;
// }
function Demo() {
  
  const [currentChainId, setCurrentChainId] = useState(Object.values(NetworkdConfig)[0].chainId)
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [bundler, setBundler] = useState(NetworkdConfig[Object.values(NetworkdConfig)[0].chainId as NetworkId].bundler[0].config.url);
  const [payMaster, setPayMaseter] = useState(NetworkdConfig[Object.values(NetworkdConfig)[0].chainId as NetworkId].paymaster[0].config.url);
  // const [batchLoading, setBatchLoading] = useState(false);
  const [mintList, setMintList] = useState<MintItem[]>([
    {
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: null,
      balance: null,
      mintBtnText: "Mint USDT",
    },
    {
      account: "0x6Ecbe1DB9EF729CBe972C83Fb886247691Fb6beb",
      amount: null,
      balance: null,
      mintBtnText: "Mint USDT",
    },
    {
      account: "0x5409ED021D9299bf6814279A6A1411A7e866A631",
      amount: null,
      balance: null,
      mintBtnText: "Mint USDT",
    },
    {
      account: "0x47E51256Fc9C7e87fd23b3444091D7A877C919B4",
      amount: null,
      balance: null,
      mintBtnText: "Mint USDT",
    },
  ]);
  

  const updateUSDTBalance = async () => {
    const TestnetERC20 = new ethers.Contract(
      NetworkdConfig[currentChainId as NetworkId].contracts.USDT,
      TetherTokenABI,
      new ethers.providers.JsonRpcProvider(
        NetworkdConfig[currentChainId as NetworkId].rpc
      )
    );
    for (let i = 0, l = mintList.length; i < l; i++) {
      TestnetERC20.balanceOf(mintList[i].account).then(
        (value: ethers.BigNumber) => {
          setMintList((items) => {
            const newItems = [...items];
            const newItem = newItems[i];
            newItem.balance = ethers.utils.formatUnits(value, 6);
            return newItems;
          });
        }
      );
    }
  };

  const mintUSDT = async (data: MintItem) => {
    const id = toast.loading("Please wait...");
    //do something else
    try {
      const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = find(NetworkdConfig[currentChainId as NetworkId].bundler, ((item) => {
        return item.config.url === bundler;
      }))
      if (!bundlerConfig) {
        alert("Please select bundler");
      }
      const payMasterConfig = find(NetworkdConfig[currentChainId as NetworkId].paymaster, ((item) => {
        return item.config.url === payMaster;
      }))
      if (!payMasterConfig) {
        alert("Please select paymaster");
      }
      console.log(bundlerConfig, payMasterConfig)
      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置
        signer: wallet, // EOA 钱包,
        rpc: NetworkdConfig[currentChainId as NetworkId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[currentChainId as NetworkId].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[currentChainId as NetworkId].rpc
        )
      );
      // Encode the calls
      const callTo = [NetworkdConfig[currentChainId as NetworkId].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          data.account,
          ethers.utils.parseUnits(data.amount ? data.amount : "0", 6),
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
      await updateUSDTBalance();
      setMintList((items) => {
        const newItems = [...items];
        const newItem: any = _.find(newItems, (mintItem: any) => {
          return mintItem.account === data.account;
        });
        if (newItem) {
          newItem.loading = false;
          newItem.mintBtnText = "Mint USDT";
        }
        return newItems;
      });
      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
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
  };

  useEffect(() => {
    
    updateUSDTBalance();
    const TransactionLogs = localStorage.getItem("TransactionLogs");
    if (TransactionLogs) {
      setTransactionLogs(JSON.parse(TransactionLogs));
    }
  }, [currentChainId]);
  // const deploy = async () => {
  //   try {
  //     if (connector) {
  //       const _provider: any = await connector.getProvider();
  //       const provider = new ethers.providers.Web3Provider(_provider);
  //       console.log(_provider, provider)
  //       const factory = new ethers.ContractFactory(
  //         TetherToken.abi,
  //         TetherToken.bytecode,
  //         provider.getSigner()
  //       );
  //     //   function TetherToken(uint _initialSupply, string _name, string _symbol, uint _decimals) public {
  //     //     _totalSupply = _initialSupply;
  //     //     name = _name;
  //     //     symbol = _symbol;
  //     //     decimals = _decimals;
  //     //     balances[owner] = _initialSupply;
  //     //     deprecated = false;
  //     // }

  //       // const deployTransaction = await factory.getDeployTransaction(
  //       //   ethers.constants.MaxInt256,
  //       //   "Test Tether USD",
  //       //   "USDT",
  //       //   6
  //       // );
  //       // const gasLimit = await provider.estimateGas(deployTransaction);
  //       // const newGasLimit = gasLimit
  //       //   .mul(ethers.utils.parseEther("1.9"))
  //       //   .div(ethers.utils.parseEther("1"));

  //       const contract = await factory.deploy(
  //         ethers.constants.MaxInt256,
  //         "Test Tether USD",
  //         "USDT",
  //         6,

  //         // {
  //         //   gasLimit: newGasLimit,
  //         // }
  //       );
  //       console.log(contract);

  //       await contract.deployTransaction.wait();
  //     }

  //     //  message.success("url update success");
  //   } catch (error: any) {
  //     console.log(error);
  //   }
  // };

  return (
    <div className={styles.root}>
      {/* <div>EOA Account: {currentWalletAddress}</div>
      <div>Smart Account: {currentSmartAccountAddress}</div> */}

      <div className={styles.header}>
        <a
          className={styles.contractLink}
          href={`${NetworkdConfig[currentChainId as NetworkId].blockExplorerURL}/address/${NetworkdConfig[currentChainId as NetworkId].contracts.USDT}`}
          target="_blank"
        >
          Contract :{" "}
          {NetworkdConfig[currentChainId as NetworkId].contracts.USDT}
        </a>
        <ConnectButton></ConnectButton>
      </div>
      {/* <button onClick={deploy}>Deploy</button> */}
      <div className={styles.selectRow}>
      <FormControl fullWidth>
          <InputLabel id="chain-label">Chain</InputLabel>
          <Select
            labelId="chain-label"
            label="Chain"
            value={currentChainId}
            onChange={(event) => {
              setCurrentChainId(event.target.value as any);
            }}
          >
            {Object.values(NetworkdConfig).map((item) => {
              return (
                <MenuItem key={item.chainId} value={item.chainId}>
                  {item.name}
                </MenuItem>
              );
            })}

          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="bundler-label">Bundler</InputLabel>
          <Select
            labelId="bundler-label"
            label="Bundler"
            value={bundler}
            onChange={(event) => {
              setBundler(event.target.value as string);
            }}
          >
            {NetworkdConfig[currentChainId as NetworkId].bundler.map((item) => {
              return (
                <MenuItem key={item.provider} value={item.config.url}>
                  {item.provider}
                </MenuItem>
              );
            })}
            {/* <MenuItem
              value={"https://public.stackup.sh/api/v1/node/ethereum-sepolia"}
            >
              Stackup
            </MenuItem>
            <MenuItem
              value={
                "https://api.pimlico.io/v2/11155111/rpc?apikey=7dc438e7-8de7-47f0-9d71-3372e57694ca"
              }
            >
              Pimlico
            </MenuItem>
            <MenuItem
              value={
                "https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44"
              }
            >
              Biconomy
            </MenuItem>
            <MenuItem
              value={
                "https://eth-sepolia.g.alchemy.com/v2/tlovr50YMFVheDJSuOJJj0RyvCHothDO"
              }
            >
              Alchemy
            </MenuItem> */}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="paymaster-label">Paymaster</InputLabel>
          <Select
            labelId="paymaster-label"
            label="Paymaster"
            value={payMaster}
            onChange={(event) => {
              setPayMaseter(event.target.value as string);
            }}
          >
            {NetworkdConfig[currentChainId as NetworkId].paymaster.map(
              (item) => {
                return (
                  <MenuItem key={item.provider} value={item.config.url}>
                    {item.provider}
                  </MenuItem>
                );
              }
            )}
          </Select>
        </FormControl>
      </div>
      <div className={styles.mintList}>
        {mintList.map((item) => {
          return (
            <div className={styles.mintRow}>
              <TextField
                label="Account"
                fullWidth
                defaultValue={item.account}
                InputProps={{
                  readOnly: true,
                }}
              />
              <TextField
                label="USDT balance"
                defaultValue={0}
                value={item.balance ? item.balance : 0}
                InputProps={{
                  readOnly: true,
                }}
              />

              <TextField
                label="Amount"
                value={item.amount}
                onChange={(event) => {
                  setMintList((items) => {
                    const newItems = [...items];
                    const newItem: any = _.find(newItems, (mintItem: any) => {
                      return mintItem.account === item.account;
                    });
                    if (newItem) {
                      newItem.amount = event.target.value;
                    }

                    return newItems;
                  });
                }}
              ></TextField>
              <LoadingButton
                variant="contained"
                loading={item.loading ? item.loading : false}
                onClick={() => {
                  setMintList((items) => {
                    const newItems = [...items];
                    const newItem: any = _.find(newItems, (mintItem: any) => {
                      return mintItem.account === item.account;
                    });
                    if (newItem) {
                      newItem.loading = true;
                      newItem.mintBtnText = "Wait...";
                    }
                    return newItems;
                  });
                  mintUSDT(item);
                }}
              >
                {item.mintBtnText}
              </LoadingButton>
            </div>
          );
        })}
      </div>

      <div className={styles.TransactionTable}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AA Acount</TableCell>
                <TableCell>User Op Hash</TableCell>
                <TableCell>Transaction</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactionLogs.map((row) => (
                <TableRow
                  key={row.userOpHash}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell>
                    {" "}
                    <a
                      href={`https://sepolia.etherscan.io/address/${row.aaAccount}`}
                      target="_blank"
                    >
                      {row.aaAccount}
                    </a>
                  </TableCell>
                  <TableCell>{row.userOpHash}</TableCell>
                  <TableCell>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${row.transactionHash}`}
                      target="_blank"
                    >
                      {row.transactionHash}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      <ToastContainer />
    </div>
  );
}

export default Demo;
