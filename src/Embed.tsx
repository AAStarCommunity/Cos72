import { Avatar } from "primereact/avatar";
import styles from "./Embed.module.css";
import { Dialog } from "primereact/dialog";
import { useEffect, useState } from "react";
import AccountSign from "./components/embed/AccountSign";

import Loading from "./components/embed/Loading";
import { Chip } from "primereact/chip";
import GoodsList from "./components/embed/GoodsList";
import { ToastContainer } from "react-toastify";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { communityListAtom } from "./atoms/Community";
import { loadUserInfoLoadingAtom, userInfoAtom } from "./atoms/UserInfo";

import { TabPanel, TabView } from "primereact/tabview";
import { useAccount } from "wagmi";

function App() {
  const [initLoaded, setInitLoaded] = useState(false);
  const { address } = useAccount();
  const [embedDialogVisible, setEmbedDialogVisible] = useState(false);
  const [userInfo, loadUserInfo]: [any, any] = useAtom(userInfoAtom);
  const infoLoading = useAtomValue(loadUserInfoLoadingAtom);
  const loadCommunityList = useSetAtom(communityListAtom);
  console.log({
    infoLoading,
  });
  useEffect(() => {
    loadUserInfo().then(() => {
      setInitLoaded(true);
      // loadCommunityList();
    });
  }, []);

  useEffect(() => {
    if (initLoaded) {
      if (!userInfo) {
        if (address) {
          loadCommunityList(address);
        }
      } else {
        loadCommunityList((userInfo as any).aa);
      }
    }
    console.log(address);
  }, [address, userInfo, initLoaded]);
  return (
    <>
      <div className={styles.root}>
        <Avatar
          className={styles.enterRoot}
          icon="pi pi-user"
          size="large"
          style={{
            backgroundColor: "#2196F3",
            color: "#ffffff",
            cursor: "pointer",
          }}
          shape="circle"
          onClick={() => {
           
            setEmbedDialogVisible(!embedDialogVisible);
          }}
        />
        <Dialog
          showHeader={false}
          visible={embedDialogVisible}
          position={"right"}
          style={{ width: "350px", height: "75vh", padding: "0px" }}
          contentStyle={{ padding: "0px" }}
          onHide={() => {
            if (!embedDialogVisible) return;
            setEmbedDialogVisible(false);
          }}
          draggable={false}
          resizable={false}
        >
          {infoLoading && <Loading></Loading>}
          {!infoLoading && !userInfo && !address && (
            <AccountSign
              onComplete={() => {
                loadUserInfo();
              }}
            ></AccountSign>
          )}
          {!infoLoading && (userInfo || address) && (
            <>
              <div className={styles.accountInfo}>
                {userInfo && (
                  <Avatar
                    shape="circle"
                    label={userInfo.email.substring(0, 1)}
                  ></Avatar>
                )}
                <Chip
                  label={`${
                    userInfo
                      ? userInfo.aa.substring(0, 6)
                      : address?.substring(0, 6)
                  }......${
                    userInfo
                      ? userInfo.aa.substring(userInfo.aa.length - 6)
                      : address?.substring(address.length - 6)
                  }`}
                ></Chip>
              </div>
              <TabView>
                <TabPanel header={"Goods"}>
                  <GoodsList />
                </TabPanel>
                <TabPanel header={"My"}>
                  <GoodsList />
                </TabPanel>
              </TabView>
            </>
          )}
        </Dialog>
      </div>
      <ToastContainer />
    </>
  );
}

export default App;
