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
import { toast, ToastContainer } from "react-toastify";
const TetherTokenABI = TetherToken.abi;
function App() {
  const menuLeft = useRef<Menu>(null);
  const [userInfo, setUserIfno] = useState<any>(null)
  const [mintLoading, setMintLoading] = useState(false);
  const [isShowAccountSignDialog, setIsShowAccountSignDialog] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("0");
  const refreshUserInfo = () => {
    loadUserInfo();
    updateUSDTBalance();
  }
  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
    //do something else
    try {
 //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0]

      const payMasterConfig = NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0]
      

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
      const callTo = [
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
      ];
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
  const updateUSDTBalance = async () => {
    if (userInfo) {
      const TestnetERC20 = new ethers.Contract(
        NetworkdConfig[networkIds.OP_SEPOLIA].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          NetworkdConfig[networkIds.OP_SEPOLIA].rpc
        )
      );
      TestnetERC20.balanceOf(userInfo.aa).then(
        (value: ethers.BigNumber) => {
          setUsdtAmount(ethers.utils.formatUnits(value, 6))
      
        }
      );
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
      setUserIfno(result)
      console.log(result);
    }
    else {
      setUserIfno(null)
    }
  }
  useEffect(() => {
    loadUserInfo();
    updateUSDTBalance();
  }, [])
  const items = [
    {
      label: "Wallet",
      icon: "pi pi-home",
    },
    {
      label: "Setting",
      icon: "pi pi-star",
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
          }
          else {
            menuLeft.current?.toggle(event)
          }
          
        }}
      >
        <Avatar icon="pi pi-user" shape="circle" />
        {userInfo ? userInfo.email : "Sign in"}
      </div>
    </div>
  );
  const accountItems: MenuItem[] = [
    {
        label: 'Options',
        items: [
            {
                label: 'Sign out',
                icon: 'pi pi-refresh',
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
                 }
            },

        ]
    }
];
  return (
    <div className={styles.Root}>
      <Menubar model={items} start={start} end={end} />
      <Menu model={accountItems} popup ref={menuLeft}  />
      <div className={styles.Content}>
      <Card className={styles.USDTContent} title="USDT Balance" >
        <div className={styles.USDTContentWrapper}>
         <div className={styles.USDTAmount}>${usdtAmount}</div>
         <div className={styles.btnRow}><Button
             loading={mintLoading}
             label="Mint"
            
             className={styles.mintUSDTBtn}
             onClick={() => {
              mintUSDT()
             }}
           /></div>
            </div>
      </Card>
      <Card className={styles.NFTContent} title="NFT List" >
         
      </Card>
      </div>
      <AccountSignDialog
        visible={isShowAccountSignDialog}
        onHide={() => {
          setIsShowAccountSignDialog(false);
          refreshUserInfo();
        }}
      ></AccountSignDialog>
       <ToastContainer />
    </div>
  );
}

export default App;
