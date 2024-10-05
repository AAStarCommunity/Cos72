/* eslint-disable @typescript-eslint/no-explicit-any */
import { CONSTANTS, PushAPI } from "@pushprotocol/restapi";
import { Avatar } from "primereact/avatar";
import styles from "./Wallet.module.css";
import AccountSignDialog from "./components/AccountSignDialog";
import { useEffect, useRef, useState } from "react";
import { Menubar } from "primereact/menubar";
import AAStarLogo from "./assets/logo-aastar.png";
import { Card } from "primereact/card";
import { ethers } from "ethers";
import { INetwork, NetworkId, networkIds, NetworkdConfig } from "./config";
import { AAStarClient, entryPointAddress } from "./sdk/AAStarClient";
import { AirAccountAPI } from "./sdk/account/AirAccountAPI";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";
import { Button } from "primereact/button";
import TetherToken from "./contracts/TetherToken.json";
import AAStarDemoNFT from "./contracts/AAStarDemoNFT.json";
import CommunityManager from "./contracts/CommunityManager.json";
import Community from "./contracts/Community.json";
import CommunityNFT from "./contracts/CommunityNFT.json";
import CommunityGoods from "./contracts/CommunityGoods.json";
import EventManager from "./contracts/EventManager.json";
import { toast, ToastContainer } from "react-toastify";
import { Chip } from "primereact/chip";
import { DataView } from "primereact/dataview";
// import { Skeleton } from "primereact/skeleton";

import SendTokenDialog from "./components/SendTokenDialog";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SendNFTDialog from "./components/SendNFTDialog";
import CreateCommunityDialog from "./components/CreateCommunityDialog";
import { Dropdown } from "primereact/dropdown";
import CreateEventDialog from "./components/CreateEventDialog";

import { InputText } from "primereact/inputtext";
import { OrderList } from "primereact/orderlist";
import { Fieldset } from "primereact/fieldset";
import { chunk, find } from "lodash";
import CreateCommunityNFTDialog from "./components/CreateCommunityNFTDialog";
import CreateCommunityPointTokenDialog from "./components/CreateCommunityPointTokenDialog";
import SentCommunityPointTokenDialog from "./components/SentCommunityPointTokenDialog";
import { JsonEditor } from "json-edit-react";
import { MulticallWrapper } from "ethers-multicall-provider";
import { TabPanel, TabView } from "primereact/tabview";
import CreateCommunityGoodsDialog from "./components/CreateCommunityGoodsDialog";

interface TransactionLog {
  aaAccount: string;
  userOpHash: string;
  transactionHash: string;
}
interface Community {
  name: string;
  address: string;
  desc: string;
  logo: string;
  pointToken: string;
  pointTokenBalance: ethers.BigNumber;
  formatPointTokenBalance: string;
  nftList: {
    name: string;
    symbol: string;
    price: string;
    address: string;
  }[];
  goodsList: {
    name: string;
    description: string;
    logo: string;
    payToken: string;
    address: string;
    receiver: string;
    price: string;
    amount: string;

  } [];
}

interface Event {
  id: number;
  name: string;
  link: string;
  desc: string;
  logo: string;
  creator: string;
  joinerList: string[];
}
const TetherTokenABI = TetherToken.abi;
const AAStarDemoNFTABI = AAStarDemoNFT.abi;
const CommunityManagerABI = CommunityManager.abi;
const EventManagerABI = EventManager.abi;
const CommunityABI = Community.abi;
const CommunityNFTABI = CommunityNFT.abi;
const CommunityGoodsABI = CommunityGoods.abi;
const ChainList = [
  NetworkdConfig[networkIds.OP_MAINNET],
  NetworkdConfig[networkIds.OP_SEPOLIA],
  NetworkdConfig[networkIds.BASE_SEPOLIA],
];

console.log(ChainList);
const saveCurrentChain = (currentChain: INetwork) => {
  localStorage.setItem("__currentChain__", `${currentChain.chainId}`);
};
const getCurrentChain = () => {
  const chain = localStorage.getItem("__currentChain__");
  if (chain) {
    return NetworkdConfig[parseInt(chain) as NetworkId];
  } else {
    return NetworkdConfig[networkIds.OP_SEPOLIA];
  }
};

let historyMsg: any[] = [];
let receiverSigner: ethers.Wallet;
let userAlice: PushAPI;

function App() {
  const menuLeft = useRef<Menu>(null);
  const [currentNetworkdConfig, setCurrentNetworkdConfig] =
    useState(NetworkdConfig);
  const [inputValue, setInputValue] = useState("");
  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  };
  const [currentChain, setCurrentChain] = useState<INetwork>(getCurrentChain());
  const currentChainId: NetworkId = currentChain.chainId as NetworkId;
  const [userInfo, setUserIfno] = useState<any>(null);
  const [currentPath, setCurrentPath] = useState("wallet");
  const [mintLoading, setMintLoading] = useState(false);
  const [mintNFTLoading, setMintNFTLoading] = useState(false);
  const [mintUSDTAndMintNFTLoading, setMintUSDTAndMintNFTLoading] =
    useState(false);
  const [tokenList, setTokenList] = useState([]);
  const [communityList, setCommunityList] = useState<Community[]>([]);
  const [currentCommunity, setCurrentCommunity] = useState<Community | null>(
    null
  );
  const [eventList, setEventList] = useState<Event[]>([]);
  const [isShowAccountSignDialog, setIsShowAccountSignDialog] = useState(false);
  const [isShowSendTokenDialog, setIsShowSendTokenDialog] = useState(false);
  const [isShowSendNFTDialog, setIsShowSendNFTDialog] = useState(false);
  const [isShowCreateCommunityDialog, setIsShowCreateCommunityDialog] =
    useState(false);
  const [isShowCreateCommunityNFTDialog, setIsShowCreateCommunityNFTDialog] =
    useState(false);
  const [isShowCreateCommunityGoodsDialog, setIsShowCreateCommunityGoodsDialog] =
    useState(false);
  const [
    isShowCreateCommunityPointTokenDialog,
    setIsShowCreateCommunityPointTokenDialog,
  ] = useState(false);
  const [
    isShowSentCommunityPointTokenDialog,
    setIsShowSentCommunityPointTokenDialog,
  ] = useState(false);
  const [isShowCreateEventDialog, setIsShowCreateEventDialog] = useState(false);
  const [currentSendNFTId, setCurrentSendNFTId] = useState(null);
  const [usdtAmount, setUsdtAmount] = useState("0");
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const refreshUserInfo = () => {
    loadUserInfo();
    // updateUSDTBalance();
    //   updateNFTBalance();
  };
  const mintUSDT = async () => {
    const id = toast.loading("Please wait...");
    setMintLoading(true);
    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentNetworkdConfig[currentChainId].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          userInfo.aa,
          ethers.utils.parseUnits("10", 6),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateUSDTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
    setMintLoading(false);
  };
  const sendUSDT = async (account: string, amount: string) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentNetworkdConfig[currentChainId].contracts.USDT];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("transfer", [
          account,
          ethers.utils.parseUnits(amount, 6),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateUSDTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const createCommunity = async (community: any) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const CommunityManagerContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.CommunityManager,
        CommunityManagerABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [
        currentNetworkdConfig[currentChainId].contracts.CommunityManager,
      ];
      const callData = [
        CommunityManagerContract.interface.encodeFunctionData(
          "createCommunity",
          [community]
        ),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const createCommunityNFT = async (
    currentCommunity: Community,
    communityNFT: any
  ) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const CommunityContract = new ethers.Contract(
        currentCommunity.address,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentCommunity.address];
      //   function createNFT(string memory _name, string memory _symbol, string memory _baseTokenURI, uint256 _price) external onlyOwner {
      //     CommunityNFT token = new CommunityNFT(msg.sender, _name, _symbol, _baseTokenURI, pointToken, _price);
      //     nftList.push(address(token));
      // }
      const callData = [
        CommunityContract.interface.encodeFunctionData("createNFT", [
          communityNFT.name,
          communityNFT.symbol,
          communityNFT.tokenURI,
          ethers.utils.parseEther(communityNFT.price),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const createCommunityGoods = async (
    currentCommunity: Community,
    communityGoods: any
  ) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const CommunityContract = new ethers.Contract(
        currentCommunity.address,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentCommunity.address];
      //   function createNFT(string memory _name, string memory _symbol, string memory _baseTokenURI, uint256 _price) external onlyOwner {
      //     CommunityNFT token = new CommunityNFT(msg.sender, _name, _symbol, _baseTokenURI, pointToken, _price);
      //     nftList.push(address(token));
      // }
      const callData = [
        CommunityContract.interface.encodeFunctionData("createGoods", [
          {
            name: communityGoods.name,
            description: communityGoods.description,
            logo: communityGoods.logo,
            payToken: communityGoods.payToken,
            receiver: communityGoods.receiver,
            amount: communityGoods.amount,
            price: communityGoods.price,
          }
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const createCommunityPointToken = async (
    currentCommunity: Community,
    communityToken: any
  ) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const CommunityContract = new ethers.Contract(
        currentCommunity.address,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentCommunity.address];
      //   function createNFT(string memory _name, string memory _symbol, string memory _baseTokenURI, uint256 _price) external onlyOwner {
      //     CommunityNFT token = new CommunityNFT(msg.sender, _name, _symbol, _baseTokenURI, pointToken, _price);
      //     nftList.push(address(token));
      // }

      //   function createPointToken(string memory _name, string memory _symbol) external onlyOwner {
      //     ERC20 token = new PointsToken(address(this), _name, _symbol);
      //     pointToken = address(token);
      // }
      const callData = [
        CommunityContract.interface.encodeFunctionData("createPointToken", [
          communityToken.name,
          communityToken.symbol,
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };
  const sendCommunityPointToken = async (
    currentCommunity: Community,
    communityToken: any
  ) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const CommunityContract = new ethers.Contract(
        currentCommunity.address,
        CommunityABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentCommunity.address];
      //   function createNFT(string memory _name, string memory _symbol, string memory _baseTokenURI, uint256 _price) external onlyOwner {
      //     CommunityNFT token = new CommunityNFT(msg.sender, _name, _symbol, _baseTokenURI, pointToken, _price);
      //     nftList.push(address(token));
      // }

      //   function createPointToken(string memory _name, string memory _symbol) external onlyOwner {
      //     ERC20 token = new PointsToken(address(this), _name, _symbol);
      //     pointToken = address(token);
      // }
      const callData = [
        CommunityContract.interface.encodeFunctionData("sendPointToken", [
          communityToken.account,
          ethers.utils.parseEther(communityToken.amount),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const createEvent = async (event: any) => {
    event.id = 0;
    event.creator = ethers.constants.AddressZero;
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const EventManagerContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.EventManager,
        EventManagerABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [
        currentNetworkdConfig[currentChainId].contracts.EventManager,
      ];
      const callData = [
        EventManagerContract.interface.encodeFunctionData("createEvent", [
          event,
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadCommunityManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };
  const joinEvent = async (event: any) => {
    const id = toast.loading("Please wait...");

    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const EventManagerContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.EventManager,
        EventManagerABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [
        currentNetworkdConfig[currentChainId].contracts.EventManager,
      ];
      const callData = [
        EventManagerContract.interface.encodeFunctionData("joinEvent", [
          event.id,
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await loadEventManagerList();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  const mintNFT = async () => {
    setMintNFTLoading(true);
    const id = toast.loading("Please wait...");
    //do something else
    try {
      // const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // const smartAccount = new AAStarClient({
      //   bundler: bundlerConfig as any, // bunder 配置
      //   paymaster: payMasterConfig as any, // payMaserter 配置
      //   signer: wallet, // EOA 钱包,
      //   rpc: currentNetworkdConfig[currentChainId as NetworkId].rpc, // rpc节点地址,
      // });

      // 第二步 创建合约调用参数
      const NFTContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentNetworkdConfig[currentChainId].contracts.NFT];
      const callData = [
        NFTContract.interface.encodeFunctionData("mint", [
          userInfo.aa,
          ethers.BigNumber.from("1"),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateNFTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
    setMintNFTLoading(false);
  };
  const sendNFT = async (account: string, tokenId: number) => {
    // setMintNFTLoading(true);
    const id = toast.loading("Please wait...");
    //do something else
    try {
      // const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // const smartAccount = new AAStarClient({
      //   bundler: bundlerConfig as any, // bunder 配置
      //   paymaster: payMasterConfig as any, // payMaserter 配置
      //   signer: wallet, // EOA 钱包,
      //   rpc: currentNetworkdConfig[currentChainId as NetworkId].rpc, // rpc节点地址,
      // });

      // 第二步 创建合约调用参数
      const NFTContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = [currentNetworkdConfig[currentChainId].contracts.NFT];
      const callData = [
        NFTContract.interface.encodeFunctionData("transferFrom", [
          userInfo.aa,
          account,
          tokenId,
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateNFTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
    setMintNFTLoading(false);
  };
  const airdropNFT = async (accountList: string[]) => {
    // setMintNFTLoading(true);
    const id = toast.loading("Please wait...");
    //do something else
    try {
      // const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // const smartAccount = new AAStarClient({
      //   bundler: bundlerConfig as any, // bunder 配置
      //   paymaster: payMasterConfig as any, // payMaserter 配置
      //   signer: wallet, // EOA 钱包,
      //   rpc: currentNetworkdConfig[currentChainId as NetworkId].rpc, // rpc节点地址,
      // });

      // 第二步 创建合约调用参数
      const NFTContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      // Encode the calls
      const callTo = accountList.map((_item: string) => {
        return currentNetworkdConfig[currentChainId].contracts.NFT;
      });
      const callData = accountList.map((_item: string) => {
        return NFTContract.interface.encodeFunctionData("mint", [
          _item,
          ethers.BigNumber.from("1"),
        ]);
      });
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateNFTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
    setMintNFTLoading(false);
  };
  const mintUSDTAndMintNFT = async () => {
    const id = toast.loading("Please wait...");
    setMintUSDTAndMintNFTLoading(true);
    //do something else
    try {
      //     const wallet = getWallet();

      // 第一步 创建 AAStarClient
      const bundlerConfig = currentNetworkdConfig[currentChainId].bundler[0];

      const payMasterConfig =
        currentNetworkdConfig[currentChainId].paymaster[0];

      const smartAccount = new AAStarClient({
        bundler: bundlerConfig as any, // bunder 配置
        paymaster: payMasterConfig as any, // payMaserter 配置

        rpc: currentNetworkdConfig[currentChainId].rpc, // rpc节点地址,
      });

      // 第二步 创建合约调用参数
      const TestnetERC20 = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      const NFTContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );

      // Encode the calls
      const callTo = [
        currentNetworkdConfig[currentChainId].contracts.USDT,
        currentNetworkdConfig[currentChainId].contracts.NFT,
      ];
      const callData = [
        TestnetERC20.interface.encodeFunctionData("_mint", [
          userInfo.aa,
          ethers.utils.parseUnits("10", 6),
        ]),
        NFTContract.interface.encodeFunctionData("mint", [
          userInfo.aa,
          ethers.BigNumber.from("1"),
        ]),
      ];
      console.log("Waiting for transaction...");
      // 第三步 发送 UserOperation
      const response = await smartAccount.sendUserOperation(callTo, callData);
      console.log(`Transaction hash: ${response.transactionHash}`);
      toast.update(id, {
        render: "Success",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      await updateUSDTBalance();
      await updateNFTBalance();

      setTransactionLogs((items) => {
        const newItems = [...items];
        newItems.unshift({
          aaAccount: response.aaAccountAddress,
          userOpHash: response.userOpHash,
          transactionHash: `${response.transactionHash}`,
        });
        localStorage.setItem("TransactionLogs", JSON.stringify(newItems));
        return newItems;
      });
    } catch (error) {
      console.log(error);
      toast.update(id, {
        render: "Transaction Fail",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
    setMintUSDTAndMintNFTLoading(false);
  };
  const updateUSDTBalance = async () => {
    if (userInfo) {
      const TestnetERC20 = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.USDT,
        TetherTokenABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      TestnetERC20.balanceOf(userInfo.aa).then((value: ethers.BigNumber) => {
        setUsdtAmount(ethers.utils.formatUnits(value, 6));
      });
    }
  };
  const updateNFTBalance = async () => {
    if (userInfo) {
      const NFTContract = new ethers.Contract(
        currentNetworkdConfig[currentChainId].contracts.NFT,
        AAStarDemoNFTABI,
        new ethers.providers.JsonRpcProvider(
          currentNetworkdConfig[currentChainId].rpc
        )
      );
      const allTokenIds = await NFTContract.getAccountTokenIds(userInfo.aa);
      const tokenIds: any = [];
      for (let i = 0, l = allTokenIds.length; i < l; i++) {
        const owner = await NFTContract.ownerOf(allTokenIds[i]);
        if (owner === userInfo.aa) {
          tokenIds.push(allTokenIds[i]);
        }
      }
      console.log("all", currentChainId, allTokenIds);
      setTokenList(
        tokenIds.map((item: any) => {
          return {
            tokenId: item.toNumber(),
            loading: false,
            matadata: null,
          };
        })
      );
      // .then((tokenIds: any) => {
      //   console.log("tokenIds", tokenIds);

      //   // for(let i = 0; i < tokenIds.length; i++) {
      //   //   NFTContract.tokenURI(tokenIds[i]).then((tokenUrl: string) => {
      //   //     return fetch(tokenUrl)
      //   //   }).then((response: any) => {
      //   //     return response.json()
      //   //   }).then((matadata: any) => {
      //   //     setTokenList((list) => {
      //   //       const newList = [...list];
      //   //       const tokenItem = find(newList, (item: any) => {
      //   //         return item.tokenId == tokenIds[i].toNumber()
      //   //       });
      //   //       if (tokenItem) {
      //   //         tokenItem.metadata = matadata;
      //   //         tokenItem.loading = false;
      //   //       }
      //   //       return newList;
      //   //     })
      //   //   })
      //   // }
      // });
    }
  };
  const loadUserInfo = async () => {
    const airAccount = new AirAccountAPI({
      provider: new ethers.providers.JsonRpcProvider(
        currentNetworkdConfig[currentChainId].rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    try {
      const result = await airAccount.getAccountInfo();
      if (result) {
        setUserIfno(result);
        console.log(result);
      } else {
        setUserIfno(null);
      }
    } catch (error) {
      setUserIfno(null);
    }
  };
  const loadCommunityManagerList = async () => {
    const provider = MulticallWrapper.wrap(
      new ethers.providers.JsonRpcProvider(
        currentNetworkdConfig[currentChainId].rpc
      )
    );
    const communityManager = new ethers.Contract(
      currentNetworkdConfig[currentChainId].contracts.CommunityManager,
      CommunityManagerABI,
      provider
    );
    const result = await communityManager.getCommunityList();
    const list: Community[] = [];
    for (let i = 0, l = result.length; i < l; i++) {
      const community = new ethers.Contract(result[i], CommunityABI, provider);
      const [name, desc, logo, nftAddressList, pointToken, goodsAddressList] = await Promise.all([
        community.name(),
        community.description(),
        community.logo(),
        community.getNFTList(),
        community.pointToken(),
        community.getGoodsList(),
      ]);

      const pointTokenContract = new ethers.Contract(
        pointToken,
        TetherTokenABI,
        provider
      );
      const pointTokenBalance = await (pointToken ===
      ethers.constants.AddressZero
        ? Promise.resolve(ethers.constants.Zero)
        : pointTokenContract.balanceOf(
            userInfo ? userInfo.aa : ethers.constants.AddressZero
          ));
      const nftList = [];
      for (let m = 0, n = nftAddressList.length; m < n; m++) {
        const communityNFT = new ethers.Contract(
          nftAddressList[m],
          CommunityNFTABI,
          provider
        );
        const [name, symbol, price] = await Promise.all([
          communityNFT.name(),
          communityNFT.symbol(),
          communityNFT.price(),
        ]);

        nftList.push({
          address: nftAddressList[m],
          name,
          symbol,
          price,
        });
      }
      const goodsList = [];
      for (let m = 0, n = goodsAddressList.length; m < n; m++) {
        const communityGoods = new ethers.Contract(
          goodsAddressList[m],
          CommunityGoodsABI,
          provider
        );
        const setting = await communityGoods.setting()

        goodsList.push({
          address: goodsAddressList[m],
          name: setting.name,
          description: setting.description,
          logo: setting.logo,
          payToken: setting.payToken,
          receiver: setting.receiver,
          price: setting.price,
          amount: setting.amount
        });
      }
      list.push({
        address: result[i],
        name,
        logo,
        desc,
        pointToken,
        pointTokenBalance,
        formatPointTokenBalance: ethers.utils.formatEther(pointTokenBalance),
        nftList: nftList,
        goodsList,
      });
    }
    setCommunityList(list);

    setCurrentCommunity((item: Community | null) => {
      if (item) {
        const newItem = find(list, (listItem) => {
          return listItem.address == item.address;
        });
        if (newItem) {
          return newItem;
        }
      }
      return item;
    });
  };
  const connectPushNotification = async () => {
    receiverSigner = ethers.Wallet.createRandom();
    console.log("signer addr: " + receiverSigner.address);
    const currentUser = await PushAPI.initialize(receiverSigner, {
      env: CONSTANTS.ENV.PROD,
    });
    const stream = await currentUser.initStream([CONSTANTS.STREAM.CHAT]);
    stream.on(CONSTANTS.STREAM.CHAT, (json) => {
      try {
        console.log(json);
        const notificationPopup = toast.loading("Loading...");
        console.log("from:", json.from);
        console.log("msg:", json.message.content);
        // save the message to the local storage
        const messages = localStorage.getItem("wallet-messages");
        if (messages) {
          const messageList = JSON.parse(messages);
          const msgObj = {
            id: json.chatId,
            from: json.from,
            message: json.message.content,
            timestamp: json.timestamp,
          };
          messageList.push(msgObj);
          localStorage.setItem("wallet-messages", JSON.stringify(messageList));
          console.log(msgObj);
        } else {
          localStorage.setItem(
            "wallet-messages",
            JSON.stringify([
              {
                id: json.chatId,
                from: json.from,
                message: json.message.content,
                timestamp: json.timestamp,
              },
            ])
          );
        }
        historyMsg.push({
          id: json.chatId,
          from: json.from,
          message: json.message.content,
          timestamp: json.timestamp,
        });
        toast.update(notificationPopup, {
          render: json.message.content,
          type: "success",
          isLoading: false,
          autoClose: 5000,
        });
      } catch (error) {
        console.log(json);
        console.log(error);
      }
    });
    stream.connect();
  };
  const itemTemplate = (item: any) => {
    console.log(item);
    return (
      <div className="flex flex-wrap p-2 align-items-center gap-3">
        <div className="flex-1 flex flex-column gap-2 xl:mr-8">
          <span className="font-bold">消息：{item.message}</span>
          <div className="flex align-items-center gap-2">
            <span>来源：{item.from}</span>
          </div>
        </div>
        <span className="font-bold text-900">
          时间：
          {new Date(parseInt(item.timestamp))
            .toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })
            .replace(/\//g, "-")}
        </span>
      </div>
    );
  };
  const getNotificationHistory = () => {
    const messages = localStorage.getItem("wallet-messages");
    historyMsg = [];
    if (messages) {
      const messageList = JSON.parse(messages);
      messageList.forEach((message: any) => {
        historyMsg.push({
          id: message.id,
          from: message.from,
          message: message.message,
          timestamp: message.timestamp,
        });
      });
    }
  };
  const sendNotification = async () => {
    console.log("sendNotification");
    const notificationPopup = toast.loading("Ready to broadcast...");
    if (userAlice == null) {
      const signerAlice = ethers.Wallet.createRandom();
      userAlice = await PushAPI.initialize(signerAlice, {
        env: CONSTANTS.ENV.PROD,
      });
    }
    toast.update(notificationPopup, {
      render: "Connected to the server...",
      type: "info",
      isLoading: false,
      autoClose: 5000,
    });
    // const stream = await userAlice.initStream([CONSTANTS.STREAM.CHAT]);
    // stream.on(CONSTANTS.STREAM.CHAT, (message) => {
    //   console.log(message);
    // });
    // stream.connect();
    const userBobAddress = receiverSigner.address;
    await userAlice.chat.send(userBobAddress, {
      content: inputValue,
      type: "Text",
    });
    console.log("Message sent from Alice to ", userBobAddress);
    toast.update(notificationPopup, {
      render: "Send success",
      type: "info",
      isLoading: false,
      autoClose: 1000,
    });
  };

  const loadEventManagerList = async () => {
    const eventManager = new ethers.Contract(
      currentNetworkdConfig[currentChainId].contracts.EventManager,
      EventManagerABI,
      new ethers.providers.JsonRpcProvider(
        currentNetworkdConfig[currentChainId].rpc
      )
    );
    const result = await eventManager.getEventList();
    const newList: Event[] = [];
    for (let i = 0, l = result.length; i < l; i++) {
      const item = result[i];
      const newItem: Event = {
        id: item.id,
        name: item.name,
        link: item.link,
        desc: item.desc,
        logo: item.logo,
        creator: item.creator,
        joinerList: [],
      };
      newItem.joinerList = await eventManager.getEventJoinList(result[i].id);
      newList.push(newItem);
    }
    setEventList(newList);
  };
  useEffect(() => {
    loadUserInfo();
    connectPushNotification();
    getNotificationHistory();
  }, []);

  useEffect(() => {
    updateUSDTBalance();
    updateNFTBalance();
    loadCommunityManagerList();
    loadEventManagerList();
  }, [userInfo, currentChainId]);

  useEffect(() => {
    const TransactionLogs = localStorage.getItem("TransactionLogs");
    if (TransactionLogs) {
      setTransactionLogs(JSON.parse(TransactionLogs));
    }
  }, []);
  const items: MenuItem[] = [
    {
      label: "Account",
      icon: "pi pi-wallet",
      className: currentPath == "wallet" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("wallet");
      },
    },

    {
      label: "Community",
      icon: "pi pi-comments",
      className: currentPath == "community" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("community");
      },
    },
    {
      label: "Event",
      icon: "pi pi-calendar-plus",
      className: currentPath == "event" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("event");
      },
    },
    {
      label: "Transaction",
      icon: "pi pi-bars",
      className: currentPath == "transaction" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("transaction");
      },
    },
    {
      label: "Setting",
      icon: "pi pi-bars",
      className: currentPath == "setting" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("setting");
      },
    },
    {
      label: "Notification",
      icon: "pi pi-bell",
      className: currentPath == "notification" ? styles.menuActive : "",
      command: () => {
        setCurrentPath("notification");
      },
    },
  ];

  const start = <img alt="logo" src={AAStarLogo} className={styles.Logo}></img>;
  const end = (
    <div className={styles.End}>
      <div className={styles.NetworkDropdown}>
        Network
        <Dropdown
          optionLabel="name"
          options={ChainList}
          value={currentChain}
          onChange={(e) => {
            setCurrentChain(e.value);
            saveCurrentChain(e.value);
          }}
        />
      </div>
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
                `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${userInfo.aa}`,
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
    </div>
  );
  const accountItems: MenuItem[] = [
    {
      label: "Options",
      items: [
        {
          label: "Sign out",
          icon: "pi pi-refresh",
          command: () => {
            const airAccount = new AirAccountAPI({
              provider: new ethers.providers.JsonRpcProvider(
                currentNetworkdConfig[currentChainId].rpc
              ),
              entryPointAddress: entryPointAddress,
            });
            airAccount.signOut();
            refreshUserInfo();
          },
        },
      ],
    },
  ];
  const listTemplate = (tokenIds: any) => {
    console.log(tokenList, tokenIds);
    return (
      <div className={styles.NFTCardList}>
        {tokenIds.map((token: any) => {
          return (
            <div className={styles.NFTCard} key={token.tokenId}>
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.NFTImg}>
                <img src={AAStarLogo}></img>
              </div>
              <div className={styles.NFTText}>Token Id #{token.tokenId}</div>
              <div className={styles.NFTText}>
                <Button
                  label="Send"
                  size="small"
                  onClick={() => {
                    setCurrentSendNFTId(token.tokenId);
                    setIsShowSendNFTDialog(true);
                  }}
                ></Button>{" "}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const communityTemplate = (communityList: Community[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardList}>
        {communityList.map((community: any) => {
          return (
            <div
              className={styles.CommunityCard}
              key={community.address}
              onClick={() => {
                setCurrentCommunity(community);
                setCurrentPath("community-detail");
              }}
            >
              {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
              <div className={styles.CommunityImg}>
                <img src={community.logo}></img>
              </div>
              <div  className={styles.CommunityCardInfo}>
                <div className={styles.CommunityText}>{community.name}</div>
                <div className={styles.CommunityText}>{community.desc}</div>
                <div className={styles.CommunityText}>
                <Chip
                className={styles.CommunityCardContractAddress}
                onClick={() => {
                  window.open(
                    `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${community.address}`,
                    "_blank"
                  );
                }}
                label={`Contract ${community.address}`}
              ></Chip></div>
              </div>
              <div></div>
            </div>
          );
        })}
      </div>
    );
  };

  const eventTemplate = (allEventList: Event[]) => {
    //console.log(tokenList, tokenIds);
    return (
      <div className={styles.CommunityCardListWrapper}>
        {" "}
        {chunk(allEventList, 4).map((eventList) => {
          return (
            <div className={styles.CommunityCardList}>
              {eventList.map((community: any) => {
                return (
                  <div className={styles.CommunityCard} key={community.id}>
                    {/* <div>{token.loading === true && <Skeleton height="100px"></Skeleton>}</div> */}
                    <div className={styles.CommunityDetailCard}>
                      <div className={styles.CommunityImg}>
                        <img src={community.logo}></img>
                      </div>
                      <div>
                        <div className={styles.CommunityText}>
                          {community.name}
                        </div>
                        <div className={styles.CommunityText}>
                          {community.desc}
                        </div>
                        <div className={styles.CommunityText}>
                          {community.pos}
                        </div>
                        <div className={styles.CommunityText}></div>
                      </div>
                      <div>
                        {" "}
                        <Button
                          label="Join"
                          size="small"
                          onClick={() => {
                            joinEvent(community);
                          }}
                        ></Button>
                      </div>
                    </div>
                    <div className={styles.joinerList}>
                      <Button
                        label="Airdrop NFT"
                        size="small"
                        onClick={() => {
                          airdropNFT(community.joinerList);
                        }}
                      ></Button>
                      <DataTable
                        size="small"
                        value={community.joinerList.map((item: string) => {
                          return {
                            value: item,
                          };
                        })}
                      >
                        <Column field="value" header="Address List"></Column>
                      </DataTable>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };
  const TransactionLog = (log: TransactionLog) => {
    return (
      <a
        href={`${currentNetworkdConfig[currentChainId].blockExplorerURL}/tx/${log.transactionHash}`}
        target="_blank"
      >
        {log.transactionHash}
      </a>
    );
  };
  console.log(currentChainId);
  return (
    <div className={styles.Root}>
      <Menubar model={items} start={start} end={end} />
      <Menu model={accountItems} popup ref={menuLeft} />
      <div className={styles.Content}>
        {currentPath === "wallet" && (
          <div className={styles.Wallet}>
            <Card className={styles.USDTContent} title="USDT Balance">
              <Chip
                className={styles.ContractAddress}
                onClick={() => {
                  window.open(
                    `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${currentNetworkdConfig[currentChainId].contracts.USDT}`,
                    "_blank"
                  );
                }}
                label={`Contract ${currentNetworkdConfig[currentChainId].contracts.USDT}`}
              ></Chip>
              <div className={styles.USDTContentWrapper}>
                <div className={styles.USDTAmount}>${usdtAmount}</div>
                <div className={styles.btnRow}>
                  <Button
                    loading={mintLoading}
                    label="Mint"
                    className={styles.mintUSDTBtn}
                    onClick={() => {
                      if (userInfo) {
                        mintUSDT();
                      } else {
                        setIsShowAccountSignDialog(true);
                      }
                    }}
                  />
                </div>

                <div className={styles.btnRow}>
                  <Button
                    label="Send"
                    className={styles.mintUSDTBtn}
                    onClick={() => {
                      setIsShowSendTokenDialog(true);
                    }}
                  />
                </div>
                <div className={styles.btnRow}>
                  <Button
                    loading={mintUSDTAndMintNFTLoading}
                    label="Mint USDT And Mint NFT"
                    className={styles.mintUSDTBtn}
                    onClick={() => {
                      if (userInfo) {
                        mintUSDTAndMintNFT();
                      } else {
                        setIsShowAccountSignDialog(true);
                      }
                    }}
                  />
                </div>
              </div>
            </Card>
            <Card className={styles.NFTContent} title="NFT List">
              {/* <DataView value={products} listTemplate={listTemplate}  /> */}
              <Chip
                className={styles.ContractAddress}
                onClick={() => {
                  window.open(
                    `${currentNetworkdConfig[currentChainId].blockExplorerURL}/address/${currentNetworkdConfig[currentChainId].contracts.NFT}`,
                    "_blank"
                  );
                }}
                label={`Contract ${currentNetworkdConfig[currentChainId].contracts.NFT}`}
              ></Chip>
              <DataView
                value={tokenList}
                listTemplate={listTemplate as any}
              ></DataView>
              <div className={styles.btnRow}>
                <Button
                  loading={mintNFTLoading}
                  label="Mint"
                  className={styles.mintUSDTBtn}
                  onClick={() => {
                    if (userInfo) {
                      mintNFT();
                    } else {
                      setIsShowAccountSignDialog(true);
                    }
                  }}
                />
              </div>
            </Card>
          </div>
        )}
        {currentPath === "transaction" && (
          <div className={styles.Transaction}>
            <DataTable
              value={transactionLogs}
              tableStyle={{ minWidth: "50rem" }}
            >
              <Column field="userOpHash" header="User Op Hash"></Column>
              <Column
                field="transactionHash"
                header="Transaction Hash"
                body={TransactionLog}
              ></Column>
            </DataTable>
          </div>
        )}

        {currentPath === "community" && (
          <div className={styles.Community}>
            <div className={styles.btnRow}>
              <Button
                loading={mintLoading}
                label="Create Community"
                className={styles.mintUSDTBtn}
                onClick={() => {
                  setIsShowCreateCommunityDialog(true);
                }}
              />
            </div>
            <DataView
              className={styles.CommunityDataView}
              value={communityList}
              listTemplate={communityTemplate as any}
            ></DataView>
          </div>
        )}
        {currentPath === "community-detail" && (
          <div className={styles.Community}>
            <div>{currentCommunity?.name}</div>
            <div>{currentCommunity?.desc}</div>

            <TabView>
              <TabPanel header="Point">
                <div>
                  Point Token : {currentCommunity?.pointToken}{" "}
                  <Button
                    label="Create"
                    onClick={() => {
                      setIsShowCreateCommunityPointTokenDialog(true);
                    }}
                  />{" "}
                  <Button
                    label="Sent"
                    onClick={() => {
                      setIsShowSentCommunityPointTokenDialog(true);
                    }}
                  ></Button>
                </div>

                <div>
                  Point Balance: {currentCommunity?.formatPointTokenBalance}{" "}
                </div>
              </TabPanel>
              <TabPanel header="NFT">
                <Button
                  label="Create NFT"
                  onClick={() => {
                    setIsShowCreateCommunityNFTDialog(true);
                  }}
                ></Button>
                <div>
                  {currentCommunity?.nftList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityNFT}>
                        <div>Name : {item.name}</div>
                        <div>Symbol : {item.symbol}</div>
                        <div>Price: {ethers.utils.formatEther(item.price)}</div>
                        <div>  <Button
                          label="Approve"
                          onClick={() => {
                            setIsShowCreateCommunityNFTDialog(true);
                          }}
                        ></Button>
                        <Button
                          label="Buy"
                          onClick={() => {
                            setIsShowCreateCommunityNFTDialog(true);
                          }}
                        ></Button></div>
                      
                      </div>
                    );
                  })}
                </div>
              </TabPanel>
              <TabPanel header="Goods">
                <Button
                  label="Create Goods"
                  onClick={() => {
                    setIsShowCreateCommunityNFTDialog(true);
                  }}
                ></Button>
                <div>
                  {currentCommunity?.goodsList.map((item) => {
                    return (
                      <div key={item.address} className={styles.CommunityNFT}>
                        <div>Name : {item.name}</div>
                        <div>Description : {item.description}</div>
                        <div>Price: {ethers.utils.formatEther(item.price)}</div>
                        <div>  </div>
                      
                      </div>
                    );
                  })}
                </div>
              </TabPanel>
            </TabView>
          </div>
        )}
        {currentPath === "event" && (
          <div className={styles.Community}>
            <div className={styles.btnRow}>
              <Button
                loading={mintLoading}
                label="Create"
                className={styles.mintUSDTBtn}
                onClick={() => {
                  setIsShowCreateEventDialog(true);
                }}
              />
            </div>
            <DataView
              className={styles.CommunityDataView}
              value={eventList}
              listTemplate={eventTemplate as any}
            ></DataView>
          </div>
        )}
        {currentPath === "setting" && (
          <div>
            <JsonEditor
              minWidth={"1000px"}
              setData={setCurrentNetworkdConfig as any}
              rootName="Config"
              theme={"githubDark"}
              data={currentNetworkdConfig}
              className={styles.configEditor}
            />
          </div>
        )}
        {currentPath === "notification" && (
          <div className={styles.Notification}>
            <div className="card xl:flex xl:justify-content-center">
              <Fieldset legend="History Messages" toggleable>
                <OrderList
                  dataKey="id"
                  value={historyMsg}
                  // onChange={(e) => setProducts(e.value)}
                  itemTemplate={itemTemplate}
                  header="Message Center"
                ></OrderList>
              </Fieldset>
            </div>
            <Fieldset legend="Broadcast" toggleable>
              <Card className={styles.USDTContent} title="Message">
                <div className="flex flex-column gap-2">
                  <InputText
                    type="text"
                    onChange={handleInputChange}
                    id="target"
                    className="p-inputtext-lg"
                    aria-describedby="target-help"
                  />
                  <Button
                    label="Send"
                    className="p-button-lg"
                    onClick={sendNotification}
                  />
                  <div className={styles.NotificationHelper}>
                    <small id="username-help">Enter message to broadcast</small>
                  </div>
                </div>
              </Card>
            </Fieldset>
          </div>
        )}
      </div>
      <AccountSignDialog
        visible={isShowAccountSignDialog}
        onHide={() => {
          setIsShowAccountSignDialog(false);
          refreshUserInfo();
        }}
      ></AccountSignDialog>
      <SendTokenDialog
        visible={isShowSendTokenDialog}
        onHide={() => {
          setIsShowSendTokenDialog(false);
        }}
        onSend={async (account: string, amount: string, callback: any) => {
          await sendUSDT(account, amount);
          setIsShowSendTokenDialog(false);
          callback();
        }}
      ></SendTokenDialog>
      <SendNFTDialog
        visible={isShowSendNFTDialog}
        onHide={() => {
          setCurrentSendNFTId(null);
          setIsShowSendNFTDialog(false);
        }}
        tokenId={currentSendNFTId}
        onSend={async (account: string, tokenId: number, callback: any) => {
          await sendNFT(account, tokenId);
          setCurrentSendNFTId(null);
          setIsShowSendNFTDialog(false);
          callback();
        }}
      ></SendNFTDialog>
      <CreateCommunityDialog
        visible={isShowCreateCommunityDialog}
        onHide={() => {
          setIsShowCreateCommunityDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          await createCommunity(data);
          callback();
          setIsShowCreateCommunityDialog(false);
        }}
      ></CreateCommunityDialog>
      <CreateEventDialog
        visible={isShowCreateEventDialog}
        onHide={() => {
          setIsShowCreateEventDialog(false);
        }}
        onCreate={async (data, callback: any) => {
          await createEvent(data);
          callback();
          setIsShowCreateEventDialog(false);
        }}
      ></CreateEventDialog>
      <CreateCommunityNFTDialog
        visible={isShowCreateCommunityNFTDialog}
        onHide={() => {
          setIsShowCreateCommunityNFTDialog(false);
        }}
        onCreate={async (data: any, callback: any) => {
          if (currentCommunity) {
            await createCommunityNFT(currentCommunity, data);
            callback();
            setIsShowCreateCommunityNFTDialog(false);
          }
        }}
      ></CreateCommunityNFTDialog>

<CreateCommunityGoodsDialog
        visible={isShowCreateCommunityGoodsDialog}
        onHide={() => {
          setIsShowCreateCommunityGoodsDialog(false);
        }}
        onCreate={async (data: any, callback: any) => {
          if (currentCommunity) {
            await createCommunityGoods(currentCommunity, data);
            callback();
            setIsShowCreateCommunityGoodsDialog(false);
          }
        }}
      ></CreateCommunityGoodsDialog>

      <CreateCommunityPointTokenDialog
        visible={isShowCreateCommunityPointTokenDialog}
        onHide={() => {
          setIsShowCreateCommunityPointTokenDialog(false);
        }}
        onCreate={async (data: any, callback: any) => {
          if (currentCommunity) {
            await createCommunityPointToken(currentCommunity, data);
            callback();
            setIsShowCreateCommunityPointTokenDialog(false);
          }
        }}
      ></CreateCommunityPointTokenDialog>
      <SentCommunityPointTokenDialog
        visible={isShowSentCommunityPointTokenDialog}
        onHide={() => {
          setIsShowSentCommunityPointTokenDialog(false);
        }}
        onCreate={async (data: any, callback: any) => {
          if (currentCommunity) {
            await sendCommunityPointToken(currentCommunity, data);
            callback();
            setIsShowSentCommunityPointTokenDialog(false);
          }
        }}
      ></SentCommunityPointTokenDialog>

      <ToastContainer />
    </div>
  );
}

export default App;
