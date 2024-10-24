/* eslint-disable @typescript-eslint/no-explicit-any */


import styles from "./CommunityAdmin.module.css";
import AccountSignDialog from "./components/AccountSignDialog";
import { useEffect, useRef, useState } from "react";
import { Menubar } from "primereact/menubar";
import AAStarLogo from "./assets/logo-aastar.png";

import { ethers } from "ethers";
import { INetwork, NetworkId, networkIds, NetworkdConfig } from "./config";
import { AAStarClient, entryPointAddress } from "./sdk/AAStarClient";
import { AirAccountAPI } from "./sdk/account/AirAccountAPI";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";
import { Button } from "primereact/button";
import TetherToken from "./contracts/TetherToken.json";
import AAStarDemoNFT from "./contracts/AAStarDemoNFT.json";

import Community from "./contracts/Community.json";
import CommunityNFT from "./contracts/CommunityNFT.json";
import CommunityGoods from "./contracts/CommunityGoods.json";
import EventManager from "./contracts/EventManager.json";
import { toast, ToastContainer } from "react-toastify";
import { Chip } from "primereact/chip";
import { DataView } from "primereact/dataview";

import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

import CreateCommunityDialog from "./components/CreateCommunityDialog";
import { Dropdown } from "primereact/dropdown";

import { find } from "lodash";
import CreateCommunityNFTDialog from "./components/CreateCommunityNFTDialog";
import CreateCommunityPointTokenDialog from "./components/CreateCommunityPointTokenDialog";
import SentCommunityPointTokenDialog from "./components/SentCommunityPointTokenDialog";
import { JsonEditor } from "json-edit-react";
import { MulticallWrapper } from "ethers-multicall-provider";
import { TabPanel, TabView } from "primereact/tabview";
import CreateCommunityGoodsDialog from "./components/CreateCommunityGoodsDialog";
import NetworkSelector from "./components/NetworkSelector";
import UserInfo from "./components/UserInfo";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { userInfoAtom } from "./atoms/UserInfo";
import { currentChainAtom } from "./atoms/CurrentChain";
import CommunityManager from "./components/CommunityManager";
import { communityListAtom } from "./atoms/Community";
import CommunityDetail from "./components/CommunityManager/CommunityDetail";

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}


interface Event {
  id: number;
  name: string;
  link: string;
  desc: string;
  logo: string;
  creator: string;
  joinerList: string[];
}






function CommunityAdmin() {

  const loadUserInfo = useSetAtom(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);
  const [currentNetworkdConfig, setCurrentNetworkdConfig] =
    useState(NetworkdConfig);
  const [currentPath, setCurrentPath] = useState("community");
  const items: MenuItem[] = [
    {
      label: "Community",
      icon: "pi pi-comments",
      className: currentPath == "community" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("community");
      },
    },
    {
      label: "Transaction",
      icon: "pi pi-bars",
      className: currentPath == "transaction" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("transaction");
      },
    },
    {
      label: "Setting",
      icon: "pi pi-bars",
      className: currentPath == "setting" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("setting");
      },
    },
  ];

  const start = <img alt="logo" src={AAStarLogo} className={styles.Logo}></img>;
  const end = (
    <div className={styles.End}>
      <div className={styles.NetworkDropdown}>
        Network
       <NetworkSelector></NetworkSelector>
      </div>
      <UserInfo></UserInfo>
   
    </div>
  );

  useEffect(() => {
    loadUserInfo().then(() => {
      loadCommunityList();
    })
  }, [])
 




//   const TransactionLog = (log: TransactionLog) => {
//     return (
//       <a
//         href={`${currentNetworkdConfig[currentChainId].blockExplorerURL}/tx/${log.transactionHash}`}
//         target="_blank"
//       >
//         {log.transactionHash}
//       </a>
//     );
//   };
//   console.log(currentChainId);
  return (
    <div className={styles.Root}>
      <Menubar model={items} start={start} end={end} />
     
      <div className={styles.Content}>


        {currentPath === "community" && (
          <CommunityManager></CommunityManager>
        )}

        {currentPath === "community-detail" && (
          <CommunityDetail></CommunityDetail>
        )}
        {/* {currentPath === "community-detail" && (
          <div className={styles.Community}>
            <div>{currentCommunity?.name}</div>
            <div>{currentCommunity?.desc}</div>

            <TabView>
              <TabPanel header="Point">
                <div>
                  Point Token : {currentCommunity?.pointToken}{" "}
                  <Button
                    label="Create"
                    onClick={() => {
                      setIsShowCreateCommunityPointTokenDialog(true);
                    }}
                  />{" "}
                  <Button
                    label="Sent"
                    onClick={() => {
                      setIsShowSentCommunityPointTokenDialog(true);
                    }}
                  ></Button>
                </div>

                <div>
                  Point Balance: {currentCommunity?.formatPointTokenBalance}{" "}
                </div>
              </TabPanel>
              <TabPanel header="NFT">
                <Button
                  label="Create NFT"
                  onClick={() => {
                    setIsShowCreateCommunityNFTDialog(true);
                  }}
                ></Button>
                <div>
                  {currentCommunity?.nftList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityNFT}>
                        <div>Name : {item.name}</div>
                        <div>Symbol : {item.symbol}</div>
                        <div>Price: {ethers.utils.formatEther(item.price)}</div>
                        <div>
                          {" "}
                          <Button
                            label="Approve"
                            onClick={() => {
                              setIsShowCreateCommunityNFTDialog(true);
                            }}
                          ></Button>
                          <Button
                            label="Buy"
                            onClick={() => {
                              setIsShowCreateCommunityNFTDialog(true);
                            }}
                          ></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabPanel>
              <TabPanel header="Goods">
              <div className={styles.btnRow}>
                <Button
                  label="Create Goods"
                  onClick={() => {
                    setIsShowCreateCommunityGoodsDialog(true);
                  }}
                ></Button>
                </div>
                <div className={styles.CommunityGoodsList}>
                  {currentCommunity?.goodsList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityGoods}>
                        <div className={styles.CommunityGoodsLogo} ><img src={item.logo} /></div>
                        <div>Name : {item.name}</div>
                        <div>Description : {item.description}</div>
                        <div>Price: {item.price} {item.payTokenSymbol}</div>
                        <div> <Chip
                className={styles.CommunityCardContractAddress}
                onClick={() => {
                  window.open(
                    `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${item.address}`,
                    "_blank"
                  );
                }}
                label={`Contract ${item.address}`}
              ></Chip> </div>
                      </div>
                    
                    );
                  })}
                </div>
              </TabPanel>
            </TabView>
          </div>
        )} */}
    
        {currentPath === "setting" && (
          <div>
            <JsonEditor
              minWidth={"1000px"}
              setData={setCurrentNetworkdConfig as any}
              rootName="Config"
              theme={"githubDark"}
              data={currentNetworkdConfig}
              className={styles.configEditor}
            />
          </div>
        )}
      
      </div>
 


      <ToastContainer />
    </div>
  );
}

export default CommunityAdmin;
