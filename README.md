

# Getting started


# Usage

```javascript
   type Provider = "stackup" | "pimlico" | "aastar" | "biconomy";
   // 设置 bunder 配置
   const bundlerConfig: BundlerConfig = {
    provider: "stackup"
    config: {
      url: url,
    }
   }
  const paymasterConfig: BundlerConfig = {
    provider: "aastar"
    config: {
      url: url,
    }
   }
   // 设置 payMaserter 配置
   // 第一步 创建 AAStarClient
    const smartAccount = new AAStarClient({
      bundler: bundlerConfig , // bunder 配置
      paymaster: paymasterConfig, // payMaserter 配置
      signer: wallet, // EOA 钱包,
      rpc: ethereumSepoliaRpcUrl // rpc节点地址, 
    });

    // 第二步 创建合约调用参数
    const TestnetERC20 = new ethers.Contract(
      TestUSDT,
      TetherTokenABI,
      new ethers.providers.JsonRpcProvider(ethereumSepoliaRpcUrl)
    );
    // Encode the calls
    const callTo = [TestUSDT];
    const callData = [
      TestnetERC20.interface.encodeFunctionData("_mint", [
        data.account,
        ethers.utils.parseUnits(data.amount ? data.amount : "0", 6),
      ]),
    
    ];
    console.log("Waiting for transaction...");
    // 第三步 发送 UserOperation
    const response = await smartAccount.sendUserOperation(callTo, callData);
    console.log(`Transaction hash: ${response.transactionHash}`);
```


## Prerequisites



## Setup



# License



# Contact

