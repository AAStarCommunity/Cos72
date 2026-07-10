# MyTask / MyShop 合约 vs AAStar Infra — 重复 / 冲突 / 应改用底层 分析

> 状态：**分析报告，待 jason review**。配合 `MODULES_REFACTOR_DESIGN.md` 看。
> 依据：对 MyTask/MyShop 合约 + `airaccount-contract 0.28 / SuperPaymaster v5.4.2 / YetAnotherAA-Validator(DVT) / AirAccount-KMS` 全量合约走查（2 个 agent，2026-07-10）。
> 判定：**CONFLICT**=撞车/冲突必须修 · **DUPLICATE**=重造轮子 · **SHOULD-USE-INFRA**=应改用底层 · **KEEP**=真·业务专属保留。

---

## 0. 一句话结论

**两个模块的合约都不是整体重复**——escrow/shop 的核心业务逻辑 infra 没有等价物，保留。但**各有几处真冲突 + 一堆「自己造了 infra 已有且更好的东西」**，尤其：
- 🔴 **MyShop 自铸 GToken/aPNTs**（还冒用同名）——**最高风险冲突**。
- 🔴 **MyTask 的 JuryContract 重造 DVT 质押/惩罚栈，且惩罚是空壳**（声明了从没实现）。
- 🔴 **两个模块都手搓 EIP-712/ecrecover + 明文私钥签名**——应改用 KMS + `isValidOwnerAuth`。
- 🔴 **两个模块都 EOA 自付 gas**——应改用 SuperPaymaster gasless。
- **决策已定**：ERC-8004 用 SuperPaymaster 的 canonical agent 注册表（见 §3）。

---

## 1. MyTask ↔ Infra

| MyTask | infra 等价物 | 判定 | SDK 暴露 |
|---|---|---|---|
| `MySBT.sol`（TASKOR/SUPPLIER/JUROR bitmask，`mintWithRoles`）| SuperPaymaster `tokens/MySBT.sol` `mintForRole` via `Registry.registerRole` | **DUPLICATE**（同名同概念，角色体系不同）| ✅ `sbtActions`（wrap infra）|
| `JuryContract` juror 质押（`registerJuror`/7天 cooldown）| `GTokenStaking.lockStakeWithTicket`/`roleLocks` | **SHOULD-USE-INFRA** | ✅ `stakingActions` |
| `JuryContract` slashing（**声明了 event/接口/NatSpec，代码里从没实现**）| `DVTValidator`+`BLSAggregator`+`GTokenStaking.slash/slashByDVT`（审计过、两步、防重放，**闲置**）| **SHOULD-USE-INFRA**（最强）| ✅ `dvtActions`/`aggregatorActions`/`stakingActions.slash` |
| `JuryContract.vote/finalizeTask`（每任务 0-100 打分均值）| DVT/BLS quorum（协议级 slash，粒度不同）| **KEEP**（任务级打分 ≠ 协议级 quorum）| n/a |
| `IERC8004ValidationRegistry`（`tag:bytes32`/0-100）| 官方 ERC-8004（`tag:string`/0-1-2）| **CONFLICT**（假冒标准、ABI 不兼容）| **决策：改用 SuperPaymaster ERC-8004**（§3）|
| `TaskEscrow(V2)` 四方分账/挑战期 | 无 infra 等价物 | **KEEP** | n/a |
| `TaskEscrowV2.acceptTaskWithSignature`（自搓 EIP-712 domain+`ecrecover`+nonce）| `AirAccountExtension.isValidOwnerAuth` + SuperPaymaster gasless | **SHOULD-USE-INFRA**（若 taskor 是 AA 账户）/ KEEP（若纯 EOA）| ✅ `airAccountExtension` actions |
| `agentId` 身份（走自家 MySBT）| `AgentRegistry.isRegisteredAgent`/`getHumanOwner` 或官方 ERC-8004 identity | **SHOULD-USE-INFRA**（跨生态 agent 身份）| ✅ `agentRegistryActions`/`ERC8004Service` |

**要点**：MyTask 的 escrow 是真专属，保留；但 **① 去掉自定义 MySBT、直接用生态 SuperPaymaster MySBT（角色走 Registry.registerRole）〔jason 定〕；② Jury 的质押/惩罚改用 GTokenStaking/DVT/BLS（现在惩罚是空承诺）；③ ERC-8004 用 SuperPaymaster（§3）**。

---

## 2. MyShop ↔ Infra

| MyShop | infra 等价物 | 判定 | SDK 暴露 |
|---|---|---|---|
| `sales/GTokenSale.sol` 自铸 "GToken"（`CAP=21_000_000 ether`，与 canonical 逐字节相同）| `tokens/GToken.sol`（canonical `ERC20Capped(21M)`，`onlyOwner` mint）| **CONFLICT** | ✅ `community.launchCommunity()`（质押真 GToken）|
| `sales/APNTsSale.sol` 自铸 "aPNTs"（**无 cap**）| SuperPaymaster `APNTS_TOKEN`（单例、治理设、7天 timelock）| **CONFLICT**（最高风险：无界铸造 + 冒用稀缺 gas-credit 名）| — 社区应发 xPNTs 而非 aPNTs |
| 店铺自有可购币（泛指）| `xPNTsFactory.deployxPNTsToken()`（per-community，带 CC-28 超发熔断/限额）| **SHOULD-USE-INFRA** | ✅ `CommunityClient.issueXPNTs()` |
| `MyShops.registerShop` 门控 `Registry.hasRole(COMMUNITY)` | `Registry.sol` 同角色也门控 `xPNTsFactory` | **KEEP**（分层正确，没重造白名单）| ✅ `registry.hasRole` |
| `MyShops.shopRoles` bitmap（店铺员工权限）| `Registry` 协议级角色（COMMUNITY/DVT/KMS…）| **KEEP**（app 级 ≠ 协议级，非重复）| n/a |
| `MyShopItems` 手搓 `_domainSeparatorV4`/`_recover`（裸 `ecrecover`，**无 low-S 保护**）| `AirAccountExtension.isValidOwnerAuth`（`0xa0cf00cf`，审计、fail-closed、防重放）| **CONFLICT**（重造更弱版本）| ⚠️ 见 §4 gap |
| Worker `permitServer.js` 用 **env 明文私钥** 签 SerialPermit/RiskAllowance | KMS/TEE `sign_typed_data` + agent-key(Bearer-JWT，无需每次 ceremony)，key 不出 TEE | **SHOULD-USE-INFRA** | ⚠️ **SDK gap**（§4）|
| `actions/MintERC721Action`（店铺任意 NFT）| `tokens/MySBT`（单例身份 SBT）| **KEEP**（loyalty NFT ≠ 身份 SBT）—— 但漏用 `MySBT.recordActivity(buyer)` + `ReputationSystem.setNFTBoost`（都 SDK 已暴露、未用）| ✅ `sbtActions.recordActivity`/`reputationActions.setNFTBoost` |
| `actions/MintERC20Action`（对任意 token mint）| 指向 canonical token 会被 mint 门控挡下 → 实际只能铸自家未受控 clone | **CONFLICT**（同 GToken/aPNTs 冲突换皮）| n/a |
| `MyShopItems.buy()` EOA 自付 gas、自付 token | SuperPaymaster gasless(`validatePaymasterUserOp`) + 价格预言机(`aPNTsPriceUSD`) + 信用额度(`getCreditLimit`+`recordDebtWithOpHash`) + x402(`X402Facilitator`) | **SHOULD-USE-INFRA**（结账全套 infra 有，MyShop 全没用）| ✅ `PaymasterClient.submitGaslessUserOperation`/`getSuperPaymasterMiddleware`/`getCreditLimit` |
| `APNTsSale/GTokenSale` 价格 timelock+drift cap | `xPNTsFactory.aPNTsPriceUSD`(Chainlink) / `xPNTsToken.updateExchangeRate`（±20%/h 冷却）| **DUPLICATE**（重造有界价更新，却建在私有 token 上）| ✅ `xPNTsFactory` 价格 setter 已 wrap |
| 单 EOA `onlyOwner` admin（setTreasury/setSigner/setFee 即时生效）| xPNTs `communityOwner`应多签 + 熔断；`AirAccountExtension` guardian+timelock；DVT BLS 多节点 co-sign | **SHOULD-USE-INFRA**（前瞻：未来 refund/提库应多签/DVT co-sign）| ⚠️ 见 §4 gap |

**要点**：MyShop **① 别自铸 GToken/aPNTs——注册 ROLE_COMMUNITY 后用 `xPNTsFactory.deployxPNTsToken` 发 xPNTs（最高优先，是 brand/安全冲突）；② permit 签名迁 KMS；③ 结账改 SuperPaymaster gasless + 预言机 + 信用；④ 挂上 `recordActivity`/`setNFTBoost` 让购买累积声誉；⑤ 治理/提库收敛多签/DVT。** registerShop 门控 + shopRoles 保留。

---

## 3. ERC-8004（决策已定：用 SuperPaymaster 能力）

MyTask 丢弃自带的 look-alike `IERC8004ValidationRegistry`（不兼容官方），**改接 SuperPaymaster 生态 canonical ERC-8004 agent 注册表**（identity / reputation / validation，`CANONICAL_ADDRESSES` 里 **Sepolia 已部署**；OP 网 `0x0`，我们选 Sepolia 不受影响）。
- JuryContract 任务打分**保留**；但 agent **身份/信誉/校验记录走 SuperPaymaster ERC-8004**，**slash 走 DVT/BLS/GTokenStaking**。
- SDK：identity+reputation 有 `ERC8004Service`；**ValidationRegistry 无 SDK wrapper**（见 §4）。

---

## 4. SDK 缺口（追加候选，SDK 暂缓——过渡期 vendored ABI + canonical 地址直连）

1. **官方 ERC-8004 ValidationRegistry 无 SDK wrapper**（`ERC8004Service` 只覆盖 identity+reputation）。→ MyTask 校验记录接入需要。
2. **KMS agent-key 的 typed-data 签名无 SDK wrapper**：`KmsAgentService.signAgent()` 只签裸 `userOpHash`（ERC-4337 用）；`signTypedDataWithWebAuthn/Ceremony` 需每次 live WebAuthn ceremony。**缺一个 `signTypedDataAgent()`（Bearer-JWT、无 ceremony）** 供后端无人值守签自定义结构（MyShop permit worker 正需要）。
3. **无「把任意 app 合约函数门控在 DVT quorum 后」的 SDK helper**（合约层 `AAStarValidator.validateAggregateSignature` 有，但没为第三方合约打包）。MyShop/MyTask 若要直接用 DVT co-sign 需要；或改走 AirAccount-owned 多签账户绕开。

---

## 5. 修复优先级（建议）

| 优先 | 项 | 模块 | 类型 |
|---|---|---|---|
| P0 | 停止自铸 GToken/aPNTs → 用 `xPNTsFactory` 发 xPNTs | MyShop | CONFLICT（brand+安全）|
| P0 | permit 明文私钥 → KMS agent-key 签名 | MyShop | CONFLICT（密钥安全）|
| P0 | ERC-8004 look-alike → SuperPaymaster canonical 注册表 | MyTask | CONFLICT（已决策）|
| P1 | Jury 质押/惩罚 → GTokenStaking + DVT/BLS（现惩罚是空壳）| MyTask | SHOULD-USE-INFRA |
| P1 | **去掉自定义 MySBT，用生态 MySBT**（角色走 Registry.registerRole）| MyTask | DUPLICATE |
| P1 | 结账 → SuperPaymaster gasless + 预言机 + 信用额度；**生态内 xPNTs 信用透支购物**（CC `d50b88b0` @sp 调研中）| MyShop | SHOULD-USE-INFRA |
| P2 | 手搓 EIP-712 校验 → `isValidOwnerAuth` | 两者 | CONFLICT |
| P2 | 挂 `recordActivity`/`setNFTBoost` 累积声誉 | MyShop | SHOULD-USE-INFRA |
| P2 | 治理/提库 → 多签 / DVT co-sign | MyShop | SHOULD-USE-INFRA（前瞻）|
| KEEP | escrow 四方分账、jury 任务打分、shopRoles、loyalty NFT、registerShop 门控 | — | 业务专属保留 |
