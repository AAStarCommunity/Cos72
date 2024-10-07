import { Avatar } from "primereact/avatar";
import styles from "./Embed.module.css";
import { Dialog } from "primereact/dialog";
import { useEffect, useState } from "react";
import AccountSign from "./components/embed/AccountSign";
import { AAStarClient } from "./sdk";
import { NetworkdConfig, networkIds } from "./config";
import { AirAccountAPI } from "./sdk/account/AirAccountAPI";
import Loading from "./components/embed/Loading";
import { Chip } from "primereact/chip";
import GoodsList from "./components/embed/GoodsList";
import { ToastContainer } from "react-toastify";

function App() {
  const [embedDialogVisible, setEmbedDialogVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const loadUserInfo = async () => {
    setInfoLoading(true);
    const smartAccount = new AAStarClient({
      bundler: NetworkdConfig[networkIds.OP_SEPOLIA].bundler[0],
      paymaster: NetworkdConfig[networkIds.OP_SEPOLIA].paymaster[0],
      rpc: NetworkdConfig[networkIds.OP_SEPOLIA].rpc,
    });
    const aaWallet = smartAccount.getAAWallet() as AirAccountAPI;
    const accountInfo = await aaWallet.getAccountInfo();
    if (accountInfo) {
      console.log(accountInfo);
      setUserInfo(accountInfo);
    }
    setInfoLoading(false);
  };

  useEffect(() => {
    loadUserInfo();
  }, []);
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
          <GoodsList communityAddress="0x98519A3a264a04a35496b0A8cAe3d4Ee35123Dd3"/>
          </>
        )}
      </Dialog>
     
    </div>
    <ToastContainer/></>
  
  );
}

export default App;
