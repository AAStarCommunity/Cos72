/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtom, useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
import styles from "./index.module.css";
import { Avatar } from "primereact/avatar";
import { Chip } from "primereact/chip";
import { userInfoAtom } from "../../atoms/UserInfo";
import { useRef, useState } from "react";
import AccountSignDialog from "../AccountSignDialog";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";

function UserInfo() {
  const menuLeft = useRef<Menu>(null);
  const currentChain = useAtomValue(currentChainAtom);
  const [userInfo, loadUserInfo] = useAtom<any>(userInfoAtom);
  const [isShowAccountSignDialog, setIsShowAccountSignDialog] = useState(false);
  const accountItems: MenuItem[] = [
    {
      label: "Options",
      items: [
        {
          label: "Sign out",
          icon: "pi pi-refresh",
          command: () => {
            (loadUserInfo as any)("signOut")
          },
        },
      ],
    },
  ];
  return (
    <>
     <Menu model={accountItems} popup ref={menuLeft} />
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
                `${currentChain.blockExplorerURL}/address/${userInfo.aa}`,
                "_blank"
              );
            }}
            label={`AAccount ${userInfo.aa.substring(
              0,
              6
            )}....${userInfo.aa.substring(userInfo.aa.length - 4)}`}
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
