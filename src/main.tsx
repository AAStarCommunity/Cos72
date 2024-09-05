import React from "react";
import ReactDOM from "react-dom/client";

import Demo from "./Demo.tsx";
import Wallet from "./Wallet.tsx";
import Register from "./Register.tsx";
import Tutorial from "./Tutorial.tsx";
import "./index.css";
import '@rainbow-me/rainbowkit/styles.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia, baseSepolia, optimism, optimismSepolia, sepolia } from "viem/chains";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrimeReactProvider } from 'primereact/api';

import "primereact/resources/themes/lara-dark-teal/theme.css";
import 'primeicons/primeicons.css';
const router = createBrowserRouter([
  {
    path: "/demo",
    element: <Demo></Demo>,
  },
  {
    path: "/",
    element: <Wallet></Wallet>,
  },
  {
    path: "/register",
    element: <Register></Register>,
  },
  {
    path: "/tutorial",
    element: <Tutorial></Tutorial>
  }
]);
const config = getDefaultConfig({
  appName: "COS72",
  projectId: "413eed66ad9f8b3bf84e79de8bde9604",
  chains: [optimism, sepolia, optimismSepolia, arbitrumSepolia, baseSepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrimeReactProvider>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <RouterProvider router={router} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </PrimeReactProvider>
  </React.StrictMode>
);
