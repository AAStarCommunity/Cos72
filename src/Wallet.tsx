/* eslint-disable @typescript-eslint/no-explicit-any */
import { Avatar } from "primereact/avatar";
import styles from "./Wallet.module.css";
import AccountSignDialog from "./components/AccountSignDialog";
import { useEffect, useRef, useState } from "react";
import { Menubar } from "primereact/menubar";
import AAStarLogo from "./assets/logo-aastar.png";
import { Card } from "primereact/card";
import { ethers } from "ethers";
import { NetworkdConfig, networkIds } from "./config";
import { AAStarClient, entryPointAddress } from "./sdk/AAStarClient";
import { AirAccountAPI } from "./sdk/account/AirAccountAPI";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";
import { Button } from "primereact/button";
import TetherToken from "./contracts/TetherToken.json";
import AAStarDemoNFT from "./contracts/AAStarDemoNFT.json";
import { toast, ToastContainer } from "react-toastify";
import { Chip } from "primereact/chip";
import { DataView } from "primereact/dataview";
// import { Skeleton } from "primereact/skeleton";

import SendTokenDialog from "./components/SendTokenDialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}
const TetherTokenABI = TetherToken.abi;
const AAStarDemoNFTABI = AAStarDemoNFT.abi;
function App() {
  const menuLeft = useRef<Menu>(null);
  const [userInfo, setUserIfno] = useState<any>(null);
  const [currentPath, setCurrentPath] = useState("wallet");
  const [mintLoading, setMintLoading] = useState(false);
  const [mintNFTLoading, setMintNFTLoading] = useState(false);
  const [mintUSDTAndMintNFTLoading, setMintUSDTAndMintNFTLoading] =
    useState(false);
  const [tokenList, setTokenList] = useState([]);
  const [isShowAccountSignDialog, setIsShowAccountSignDialog] = useState(false);
  const [isShowSendTokenDialog, setIsShowSendTokenDialog] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("0");
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const refreshUserInfo = () => {
    loadUserInfo();
    // updateUSDTBalance();
    //   updateNFTBalance();
  };
  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
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
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      // Encode the calls
      const callTo = [NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          userInfo.aa,
          ethers.utils.parseUnits("10", 6),
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
    setMintLoading(false);
  };
  const sendUSDT = async (account: string, amount: string) => {
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
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      // Encode the calls
      const callTo = [NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("transfer", [
          account,
          ethers.utils.parseUnits(amount, 6),
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
  const mintNFT = async () => {
    setMintNFTLoading(true);
    const id = toast.loading("Please wait...");
    //do something else
    try {
      // const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0];

      const payMasterConfig =
        NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc, // rpc节点地址,
      });

      // const smartAccount = new AAStarClient({
      //   bundler: bundlerConfig as any, // bunder 配置
      //   paymaster: payMasterConfig as any, // payMaserter 配置
      //   signer: wallet, // EOA 钱包,
      //   rpc: NetworkdConfig[currentChainId as NetworkId].rpc, // rpc节点地址,
      // });

      // 第二步 创建合约调用参数
      const NFTContract = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      // Encode the calls
      const callTo = [NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT];
      const callData = [
        NFTContract.interface.encodeFunctionData("mint", [
          userInfo.aa,
          ethers.BigNumber.from("1"),
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
      await updateNFTBalance();

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
    setMintNFTLoading(false);
  };

  const mintUSDTAndMintNFT = async () => {
    const id = toast.loading("Please wait...");
    setMintUSDTAndMintNFTLoading(true);
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
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      const NFTContract = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );

      // Encode the calls
      const callTo = [
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT,
      ];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          userInfo.aa,
          ethers.utils.parseUnits("10", 6),
        ]),
        NFTContract.interface.encodeFunctionData("mint", [
          userInfo.aa,
          ethers.BigNumber.from("1"),
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
      await updateNFTBalance();

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
    setMintUSDTAndMintNFTLoading(false);
  };
  const updateUSDTBalance = async () => {
    if (userInfo) {
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      TestnetERC20.balanceOf(userInfo.aa).then((value: ethers.BigNumber) => {
        setUsdtAmount(ethers.utils.formatUnits(value, 6));
      });
    }
  };
  const updateNFTBalance = async () => {
    if (userInfo) {
      const NFTContract = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      NFTContract.getAccountTokenIds(userInfo.aa).then((tokenIds: any) => {
        console.log("tokenIds", tokenIds);
        setTokenList(
          tokenIds.map((item: any) => {
            return {
              tokenId: item.toNumber(),
              loading: false,
              matadata: null,
            };
          })
        );
        // for(let i = 0; i < tokenIds.length; i++) {
        //   NFTContract.tokenURI(tokenIds[i]).then((tokenUrl: string) => {
        //     return fetch(tokenUrl)
        //   }).then((response: any) => {
        //     return response.json()
        //   }).then((matadata: any) => {
        //     setTokenList((list) => {
        //       const newList = [...list];
        //       const tokenItem = find(newList, (item: any) => {
        //         return item.tokenId == tokenIds[i].toNumber()
        //       });
        //       if (tokenItem) {
        //         tokenItem.metadata = matadata;
        //         tokenItem.loading = false;
        //       }
        //       return newList;
        //     })
        //   })
        // }
      });
    }
  };
  const loadUserInfo = async () => {
    const airAccount = new AirAccountAPI({
      //  apiBaseUrl: "https://anotherairaccountcommunitynode.onrender.com",
      provider: new ethers.providers.JsonRpcProvider(
        NetworkdConfig[networkIds.OP_SEPOLIA].rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    const result = await airAccount.getAccountInfo();
    if (result) {
      setUserIfno(result);
      console.log(result);
    } else {
      setUserIfno(null);
    }
  };
  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    updateUSDTBalance();
    updateNFTBalance();
  }, [userInfo]);

  useEffect(() => {
    
    const TransactionLogs = localStorage.getItem("TransactionLogs");
    if (TransactionLogs) {
      setTransactionLogs(JSON.parse(TransactionLogs));
    }
  }, []);
  const items: MenuItem[] = [
    {
      label: "Wallet",
      icon: "pi pi-wallet",
      className: currentPath == "wallet"? styles.menuActive : "",
      command: () => {
        setCurrentPath("wallet")
      },
    
    },
    {
      label: "Transaction",
      icon: "pi pi-bars",
      className: currentPath == "transaction"? styles.menuActive : "",
      command: () => {
        setCurrentPath("transaction")
      },
    },
    {
      label: "Setting",
      icon: "pi pi-cog",
      className: currentPath == "setting"? styles.menuActive : "",
      command: () => {
        setCurrentPath("setting")
      },
    },
  ];

  const start = <img alt="logo" src={AAStarLogo} className={styles.Logo}></img>;
  const end = (
    <div className={styles.End}>
      <div
        className={styles.Avatar}
        onClick={(event) => {
          if (!userInfo) {
            setIsShowAccountSignDialog(true);
          } else {
            menuLeft.current?.toggle(event);
          }
        }}
      >
        <Avatar icon="pi pi-user" shape="circle" />
        {userInfo ? userInfo.email : "Sign in"}
        {userInfo && (
          <Chip
            onClick={() => {
              window.open(
                `${
                  NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL
                }/address/${userInfo.aa}`,
                "_blank"
              );
            }}
            label={`AAccount ${userInfo.aa}`}
          ></Chip>
        )}
      </div>
    </div>
  );
  const accountItems: MenuItem[] = [
    {
      label: "Options",
      items: [
        {
          label: "Sign out",
          icon: "pi pi-refresh",
          command: () => {
            const airAccount = new AirAccountAPI({
              //  apiBaseUrl: "https://anotherairaccountcommunitynode.onrender.com",
              provider: new ethers.providers.JsonRpcProvider(
                NetworkdConfig[networkIds.OP_SEPOLIA].rpc
              ),
              entryPointAddress: entryPointAddress,
            });
            airAccount.signOut();
            refreshUserInfo();
          },
        },
      ],
    },
  ];
  const listTemplate = (tokenIds: any) => {
    console.log(tokenList, tokenIds);
    return (
      <div className={styles.NFTCardList}>
        {tokenIds.map((token: any) => {
          return (
            <div className={styles.NFTCard} key={token.tokenId}>
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.NFTImg}>
                <img src={AAStarLogo}></img>
              </div>
              <div className={styles.NFTText}>Token Id #{token.tokenId}</div>
            </div>
          );
        })}
      </div>
    );
  };
  const TransactionLog = (log: TransactionLog) => {
    return <a  href={`${NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL}/tx/${log.transactionHash}`}
    target="_blank">{log.transactionHash}</a>;
 };
  return (
    <div className={styles.Root}>
      <Menubar model={items} start={start} end={end} />
      <Menu model={accountItems} popup ref={menuLeft} />
      <div className={styles.Content}>
       { currentPath === "wallet"  && <div className={styles.Wallet}>
          <Card className={styles.USDTContent} title="USDT Balance">
            <Chip
              className={styles.ContractAddress}
              onClick={() => {
                window.open(
                  `${
                    NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL
                  }/address/${
                    NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT
                  }`,
                  "_blank"
                );
              }}
              label={`Contract ${
                NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT
              }`}
            ></Chip>
            <div className={styles.USDTContentWrapper}>
              <div className={styles.USDTAmount}>${usdtAmount}</div>
              <div className={styles.btnRow}>
                <Button
                  loading={mintLoading}
                  label="Mint"
                  className={styles.mintUSDTBtn}
                  onClick={() => {
                    if (userInfo) {
                      mintUSDT();
                    } else {
                      setIsShowAccountSignDialog(true);
                    }
                  }}
                />
              </div>

              <div className={styles.btnRow}>
                <Button
                  label="Send"
                  className={styles.mintUSDTBtn}
                  onClick={() => {
                    setIsShowSendTokenDialog(true);
                  }}
                />
              </div>
              <div className={styles.btnRow}>
                <Button
                  loading={mintUSDTAndMintNFTLoading}
                  label="Mint USDT And Mint NFT"
                  className={styles.mintUSDTBtn}
                  onClick={() => {
                    if (userInfo) {
                      mintUSDTAndMintNFT();
                    } else {
                      setIsShowAccountSignDialog(true);
                    }
                  }}
                />
              </div>
            </div>
          </Card>
          <Card className={styles.NFTContent} title="NFT List">
            {/* <DataView value={products} listTemplate={listTemplate}  /> */}
            <Chip
              className={styles.ContractAddress}
              onClick={() => {
                window.open(
                  `${
                    NetworkdConfig[networkIds.OP_SEPOLIA].blockExplorerURL
                  }/address/${
                    NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT
                  }`,
                  "_blank"
                );
              }}
              label={`Contract ${
                NetworkdConfig[networkIds.OP_SEPOLIA].contracts.NFT
              }`}
            ></Chip>
            <DataView
              value={tokenList}
              listTemplate={listTemplate as any}
            ></DataView>
            <div className={styles.btnRow}>
              <Button
                loading={mintNFTLoading}
                label="Mint"
                className={styles.mintUSDTBtn}
                onClick={() => {
                  if (userInfo) {
                    mintNFT();
                  } else {
                    setIsShowAccountSignDialog(true);
                  }
                }}
              />
            </div>
          </Card>
        </div>
       }
       {
        currentPath === "transaction" && <div className={styles.Transaction}>
 <DataTable value={transactionLogs} tableStyle={{ minWidth: '50rem' }}>
                <Column field="userOpHash" header="User Op Hash"></Column>
                <Column field="transactionHash" header="Transaction Hash" body={TransactionLog}></Column>

            </DataTable>
          </div>
       }
      </div>
      <AccountSignDialog
        visible={isShowAccountSignDialog}
        onHide={() => {
          setIsShowAccountSignDialog(false);
          refreshUserInfo();
        }}
      ></AccountSignDialog>
      <SendTokenDialog
        visible={isShowSendTokenDialog}
        onHide={() => {
          setIsShowSendTokenDialog(false);
        }}
        onSend={async (account: string, amount: string, callback: any) => {
          await sendUSDT(account, amount);
          setIsShowSendTokenDialog(false);
          callback();
        }}
      ></SendTokenDialog>
      <ToastContainer />
    </div>
  );
}

export default App;
