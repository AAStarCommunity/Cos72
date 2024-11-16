/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtom } from "jotai";

import styles from "./index.module.css";
import { Avatar } from "primereact/avatar";
import { Chip } from "primereact/chip";
import { userInfoAtom } from "../../atoms/UserInfo";
import { useEffect, useRef, useState } from "react";
import AccountSignDialog from "../AccountSignDialog";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";
import { useAccount, useDisconnect } from "wagmi";
import { useNavigate } from "react-router-dom";

function UserInfo() {
  const menuLeft = useRef<Menu>(null);
  const account  = useAccount(); 
  const { disconnect } = useDisconnect()
  
  const [userInfo, loadUserInfo] = useAtom<any>(userInfoAtom);
  const [isShowAccountSignDialog, setIsShowAccountSignDialog] = useState(false);
  const navigate = useNavigate();
  const accountItems: MenuItem[] = [
    {
     
      items: [
        {
          label:"Shopping",
          icon: "pi pi-shopping-bag",
          command: () => {
            navigate("/")
          },
        },
        {
          label: "Create Store",
          icon: "pi pi-wallet",
          command: () => {
            navigate("/admin/community")
          },
        },
        {
          label: "Sign out",
          icon: "pi pi-refresh",
          command: () => {
            if (account && account.address) {
              disconnect();
            }
            if (userInfo) {
              (loadUserInfo as any)("signOut")
            }
          },
        },
      ],
    },
  ];
  useEffect(() => {
    if (account && account.address) {
      setIsShowAccountSignDialog(false);
    }
  }, [account])
  return (
    <>
     <Menu model={accountItems} popup ref={menuLeft} />
      <div
        className={styles.Avatar}
        onClick={(event) => {
          if (!userInfo && !account.address) {
            setIsShowAccountSignDialog(true);
          } else {
             menuLeft.current?.toggle(event);
          }
        }}
      >
        <Avatar icon="pi pi-user" shape="circle" /> 
        {userInfo  ? userInfo.email : ( !account.address ? "Sign in" : "")}
        {userInfo && (
          <Chip
            // onClick={() => {
            //   window.open(
            //     `${currentChain.blockExplorerURL}/address/${userInfo.aa}`,
            //     "_blank"
            //   );
            // }}
            label={`AAccount ${userInfo.aa.substring(
              0,
              6
            )}....${userInfo.aa.substring(userInfo.aa.length - 4)}`}
          ></Chip>
        )}
          {(account && account.address) && (
          <Chip
            // onClick={() => {
            //   window.open(
            //     `${currentChain.blockExplorerURL}/address/${account.address}`,
            //     "_blank"
            //   );
            // }}
            label={`Wallet ${account.address.substring(
              0,
              6
            )}....${account.address.substring(account.address.length - 4)}`}
          ></Chip>
        )}
      </div>
      <AccountSignDialog
        visible={isShowAccountSignDialog}
        onHide={() => {
          setIsShowAccountSignDialog(false);
          //    refreshUserInfo();
        }}
      ></AccountSignDialog>
    </>
  );
}

export default UserInfo;
