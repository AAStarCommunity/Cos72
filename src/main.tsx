import React from "react";
import ReactDOM from "react-dom/client";

import Demo from "./Demo.tsx";
import "./index.css";
import '@rainbow-me/rainbowkit/styles.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { optimismSepolia, sepolia } from "viem/chains";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const router = createBrowserRouter([
  {
    path: "/",
    element: <Demo></Demo>,
  },
]);
const config = getDefaultConfig({
  appName: "Demo",
  projectId: "413eed66ad9f8b3bf84e79de8bde9604",
  chains: [sepolia, optimismSepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <RouterProvider router={router} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
