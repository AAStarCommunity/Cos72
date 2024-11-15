import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import styles from "./main.module.css";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import { BrowserRouter , Route, Routes } from "react-router-dom";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { optimismSepolia } from "viem/chains";
import { useAccount, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrimeReactProvider } from "primereact/api";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primeicons/primeicons.css";
import CommunityAdmin from "./CommunityAdmin.tsx";
import { Toolbar } from "primereact/toolbar";
import NetworkSelector from "./components/NetworkSelector/index.tsx";
import UserInfo from "./components/UserInfo/index.tsx";
import Goods from "./Goods";
import AAStarLogo from "./assets/logo-aastar.png";
import { useAtom, useSetAtom } from "jotai";
import { communityListAtom } from "./atoms/Community.ts";
import { userInfoAtom } from "./atoms/UserInfo.ts";
import { ethers } from "ethers";

const config = getDefaultConfig({
  appName: "COS72",
  projectId: "413eed66ad9f8b3bf84e79de8bde9604",
  chains: [optimismSepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
const queryClient = new QueryClient();
function App() {
  const { address } = useAccount();
  const [initLoaded, setInitLoaded] = useState(false);
  const [userInfo, loadUserInfo] = useAtom(userInfoAtom);
  const loadCommunityList = useSetAtom(communityListAtom);

  useEffect(() => {
    loadUserInfo().then(() => {
      setInitLoaded(true)
     // loadCommunityList();
    })
  }, [])

  useEffect(() => {
    if (initLoaded) {
      if (!userInfo) {
        if (address) {
          loadCommunityList(address)
        }
        else {
          loadCommunityList(ethers.constants.AddressZero)
        }
      }
      else {
        loadCommunityList((userInfo as any).aa)
      }
    }
    console.log(address);
  }, [address, userInfo, initLoaded])
  return (
    <BrowserRouter>
    <div className={styles.Root}>
      <Toolbar
        start={<img alt="logo" src={AAStarLogo} className={styles.Logo}></img>}
        end={
          <div className={styles.End}>
            <div className={styles.NetworkDropdown}>
              Network
              <NetworkSelector></NetworkSelector>
            </div>
            <UserInfo></UserInfo>
          </div>
        }
      />
      <div className={styles.Content}>
      <Routes>
          <Route path="/" element={<Goods />} />
          <Route path="/admin" element={<CommunityAdmin />} />
        </Routes>
      </div>
    </div>
    </BrowserRouter>
  );
}

export default Goods;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrimeReactProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <App></App>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrimeReactProvider>
  </React.StrictMode>
);
