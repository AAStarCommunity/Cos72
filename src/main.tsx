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


import NetworkSelector from "./components/NetworkSelector/index.tsx";
import UserInfo from "./components/UserInfo/index.tsx";
import Goods from "./Goods";
import AAStarLogo from "./assets/logo-aastar.png";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { communityListAtom, loadCommunityListLoadingAtom } from "./atoms/Community.ts";
import { userInfoAtom } from "./atoms/UserInfo.ts";
import { ethers } from "ethers";
import CommunityManager from "./components/CommunityManager/index.tsx";
import { ToastContainer } from "react-toastify";
import CommunityDetail from "./components/CommunityManager/CommunityDetail.tsx";
import CommunityStoreDetail from "./components/CommunityManager/CommunityStoreDetail.tsx";
import DataLoading from "./components/DataLoading/index.tsx";
import 'react-toastify/dist/ReactToastify.css';
import "swiper/css";
import "swiper/css/navigation";
import OrderApp from "./Order.tsx";
import Setting from "./Setting.tsx";
import GoodsDetail from "./GoodsDetail.tsx";
import StoreDetail from "./StoreDetail.tsx";
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
  const loading = useAtomValue(loadCommunityListLoadingAtom)
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
        <div className={styles.NavWrapper}>
          <div className={styles.Nav}>
            <img alt="logo" src={AAStarLogo} className={styles.Logo}></img>
            <div className={styles.End}>
              <div className={styles.NetworkDropdown}>
                Network
                <NetworkSelector></NetworkSelector>
              </div>
              <UserInfo></UserInfo>
            </div>
          </div>
        </div>
        <div className={styles.Content}>
          <Routes>
            <Route path="/" element={<Goods />} />
            <Route path="/order" element={<OrderApp />} />
            <Route path="/admin/setting" element={<Setting />} />
            <Route path="/admin/community" element={<CommunityManager />} />
            <Route
              path="/admin/community/:address"
              element={<CommunityDetail />}
            />
            <Route
              path="/admin/community/:address/store/:storeAddress"
              element={<CommunityStoreDetail />}
            />
            <Route
              path="/community/:address/store/:storeAddress"
              element={<StoreDetail />}
            />
            <Route
              path="/community/:address/store/:storeAddress/goods/:goodsId"
              element={<GoodsDetail />}
            />
          </Routes>
          <ToastContainer />
        </div>
      </div>
      {loading && <DataLoading></DataLoading>}
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
