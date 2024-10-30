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

function App() {
  const [embedDialogVisible, setEmbedDialogVisible] = useState(false);
  const [userInfo, loadUserInfo] : [any, any] = useAtom(userInfoAtom);
  const infoLoading = useAtomValue(loadUserInfoLoadingAtom);
  const loadCommunityList = useSetAtom(communityListAtom);
  console.log({
    infoLoading
  })
  useEffect(() => {
    loadUserInfo().then(() => {
      loadCommunityList();
    })
  }, [])
  return (
    <>
      <div className={styles.root}>
      <Avatar
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
        style={{ width: "350px", height: "70vh" }}
        onHide={() => {
          if (!embedDialogVisible) return;
          setEmbedDialogVisible(false);
        }}
        draggable={false}
        resizable={false}
      >
        {infoLoading && <Loading></Loading>}
        {!infoLoading && !userInfo && (
          <AccountSign
            onComplete={() => {
              loadUserInfo();
            }}
          ></AccountSign>
        )}
        {!infoLoading && userInfo && (
          <>
          <div className={styles.accountInfo}>
            {
              <Avatar
                shape="circle"
                label={userInfo.email.substring(0, 1)}
              ></Avatar>
            }
            <Chip
              label={`${userInfo.aa.substring(
                0,
                6
              )}......${userInfo.aa.substring(userInfo.aa.length - 6)}`}
            ></Chip>
          </div>
          <GoodsList/>
          </>
        )}
      </Dialog>
     
    </div>
    <ToastContainer/></>
  
  );
}

export default App;
