/* eslint-disable @typescript-eslint/no-explicit-any */


import styles from "./CommunityAdmin.module.css";
import { useEffect, useState } from "react";
import { Menubar } from "primereact/menubar";
import AAStarLogo from "./assets/logo-aastar.png";

import { NetworkdConfig } from "./config";
import { MenuItem } from "primereact/menuitem";

import { ToastContainer } from "react-toastify";



import { JsonEditor } from "json-edit-react";
import NetworkSelector from "./components/NetworkSelector";
import UserInfo from "./components/UserInfo";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { userInfoAtom } from "./atoms/UserInfo";
import CommunityManager from "./components/CommunityManager";
import { communityListAtom, loadCommunityListLoadingAtom } from "./atoms/Community";
import CommunityDetail from "./components/CommunityManager/CommunityDetail";
import { breadCrumbListAtom, currentPathAtom } from "./atoms/CurrentPath";
import DataLoading from "./components/DataLoading";
import CommunityStoreDetail from "./components/CommunityManager/CommunityStoreDetail";
import { BreadCrumb } from "primereact/breadcrumb";







function CommunityAdmin() {

  const loadUserInfo = useSetAtom(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);
  const breadCrumbList = useAtomValue(breadCrumbListAtom);
  const loadCommunityListLoading = useAtomValue(loadCommunityListLoadingAtom)
  const [currentNetworkdConfig, setCurrentNetworkdConfig] =
    useState(NetworkdConfig);

  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);
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
        <BreadCrumb model={breadCrumbList} onClick={(event) => {
          console.log(event.target)
        }}></BreadCrumb>

        {currentPath === "community" && (
          <CommunityManager></CommunityManager>
        )}

        {currentPath === "community-detail" && (
          <CommunityDetail></CommunityDetail>
        )}
         {currentPath === "community-store-detail" && (
          <CommunityStoreDetail></CommunityStoreDetail>
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
 

      <DataLoading loading={loadCommunityListLoading}></DataLoading>
      <ToastContainer />
    </div>
  );
}

export default CommunityAdmin;
