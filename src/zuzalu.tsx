import React from "react";
import ReactDOM from "react-dom/client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrimeReactProvider } from 'primereact/api';
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import {  optimismSepolia } from "viem/chains";
import "primereact/resources/themes/lara-dark-teal/theme.css";
import 'primeicons/primeicons.css';
import '@rainbow-me/rainbowkit/styles.css';
import App from "./Embed";
// const nodeID = "__cos72__embed";
// function initNode() {
//    let node = document.getElementById(nodeID);
//    if (!node) {
//     node = document.createElement("div");
//     node.id = nodeID;
//     node.style.position = "fixed";
//     node.style.right = "20px";
//     node.style.bottom = "20px"
//     node.style.width = "200px"
//     node.style.height = "200px"
//     node.style.zIndex = "3000";
//     document.body.appendChild(node);

//    }
//    //const nodeID =  document.createElement("div")
// }

//initNode();
const config = getDefaultConfig({
  appName: "COS72",
  projectId: "413eed66ad9f8b3bf84e79de8bde9604",
  chains: [optimismSepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
const queryClient = new QueryClient();
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
