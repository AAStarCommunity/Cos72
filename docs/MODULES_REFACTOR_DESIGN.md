# Cos72 三模块重构设计稿（MyTask / MyShop / MyVote）

> 状态：**设计稿，待 jason review 后再开发**。
> 依据：对 `~/Dev/mycelium/{MyTask,MyShop,MyVote}` + 基础仓库（`aastar-sdk 0.41 / airaccount-contract 0.28 / SuperPaymaster v5.4.2 / AirAccount-KMS`）的彻底代码走查（4 个并行 agent，2026-07-10）。
> 目标：把三模块作为 Cos72 皮肤（① 界面风格一致 ② AirAccount 登录打通）重新集成，并**融汇所有基础仓库新能力**。

---

## 0. 一句话结论

**三模块的现状高度同构，问题也同构**：合约/后端扎实可复用，但**前端全部用裸 `window.ethereum` EOA 签名、零 `@aastar/sdk`、零 AirAccount、零社区/xPNTs/gasless/SBT**。所以重构的**大头不是各改各的，而是先建一层 Cos72 共享集成层，三模块共用**。

| 模块 | 合约 | 后端 | 前端 | 与 AirAccount 差距 |
|---|---|---|---|---|
| **MyTask** | ✅ TaskEscrowV2/Jury/MySBT 可复用（注意别部署 v1） | ✅ x402 api-server 可复用 | 🟡 已是 YAAA `app/tasks`（Next/Tailwind，UI 可留）| 🔴 自建 window.ethereum 钱包层，绕过 AirAccount |
| **MyShop** | ✅ MyShops/Items/sales/actions 可复用 | 🟡 permit-signer 逻辑当 spec，进程需重托管 | 🔴 Vite **vanilla JS 4015 行**，需重建 | 🔴 window.ethereum EOA，无 AA |
| **MyVote** | —（off-chain Snapshot）| —（接 stock hub.snapshot.org）| 🔴 Vue3，**独立保留**（不移植）| 🔴 **「已集成 AirAccount」是假的**：只有空 stub，投票路径硬编码 window.ethereum |

⚠️ **两个认知更正**（走查推翻了旧假设）：
1. **MyVote 不是 Snapshot fork**，是从零写的 Vue3 客户端接官方 Snapshot Hub（off-chain EIP-712 投票）；且 **AirAccount 集成从未实现**（`airAccountProvider.ts` 无 adapter 时每个方法都 throw）。所以「独立 + SSO」不是接现成插件，而是**从零建 adapter + SSO 桥 + 重构投票签名路径**。
2. **MyTask 前端就是 YAAA `app/tasks`**（已并入），但它**自建 window.ethereum 钱包、绕过 `WalletContext`**（代码里自己注释承认），并不满足「AirAccount 登录打通」。

---

## 1. 共享集成层（Phase 0，三模块的前置，必须先建）

三模块需要的是同一套底座。在 Cos72（继承 YAAA 基座，YAAA 已有 AirAccount passkey 登录）上补齐：

| 能力 | 现状 | 要建什么 | 用哪些基础能力 |
|---|---|---|---|
| **统一 AirAccount 会话** | 三模块各连各的 window.ethereum | 一个全局会话：passkey 登录（走 `kms.aastar.io`）→ 拿到 AA 智能账户地址 + 签名能力；模块**只消费这个会话**，不再碰 window.ethereum | `PasskeyManager.authenticate()`（@aastar/airaccount）；`isValidOwnerAuth 0xa0cf00cf` off-chain 校验 |
| **SDK 中介的写交易路径** | 每处 `walletClient.writeContract` 直发 EOA tx | `lib/sdk/tx.ts`：任何合约写 → 经 AirAccount + **SuperPaymaster gasless UserOp**（paymaster middleware）提交，替换所有 EOA writeContract 调用点 | `@aastar/paymaster` `getSuperPaymasterMiddleware`/`checkEligibility`/`dryRunValidation`；tier 路由 `resolveTier`/`resolveTokenTier`（⚠️ 老模块自算 tier 边界有 latent bug，必须改用 SDK） |
| **canonical 地址解析** | 手填 `NEXT_PUBLIC_*_ADDRESS` | 地址一律从 `@aastar/sdk` canonical 取；RPC/bundler 走 `config/brand.ts` 运行时配置页（.env 覆盖）| `CANONICAL_ADDRESSES`、`COMMUNITY_SAFE`、`DVT_VALIDATOR_ADDRESS` 常量 |
| **角色 → 菜单** | 无角色门控 | 读链上角色 → 驱动 Cos72 角色菜单 | `Registry.hasRole(ROLE_COMMUNITY/...)`、`MySBT` memberships/roles、MyShop shopRoles bitmap |
| **社区 + xPNTs 绑定** | 无社区概念，奖励币硬编码 | 建号即 `CommunityClient.launchCommunity()`（approve→stake→registerRole 一步）；每社区一个 xPNTs；模块经济绑到该 xPNTs + 展示**可信度徽章** | `CommunityClient.launchCommunity/issueXPNTs`；`xPNTsTokenActions().getCredibility()`（CC-33，0.41 新，老模块必然没有）；over-issuance cap |

> **要点**：Phase 0 做完，三模块的「登录/签名/付费/地址/角色/社区币」就都统一了，各模块只剩自己的业务 UI + 合约接线。

---

## 2. 分模块设计

### 2.1 MyTask（成本最低，先做，验证共享层）

**复用**：`TaskEscrowV2` + `JuryContract` + `MySBT` 合约（**部署 V2，别用默认脚本的 v1**）；`packages/api-server`（x402）；UI 骨架（已是 Next/Tailwind）。

**重构**：
- `TaskContext.tsx` + `app/tasks/*` 的 window.ethereum 钱包层 → 换共享 AirAccount+SDK 写路径；**去掉 EIP-2612 permit 的 EOA 签名**（AA 智能账户不能直接 EOA typed-data 授权）→ 改 gasless 授权（SuperPaymaster / session key）。
- 加**社区归属**：任务属于社区 X，奖励币 = 该社区 xPNTs（现在是硬编码单一 `DEFAULT_REWARD_TOKEN`）。
- **MySBT 角色前端门控**（ROLE_TASKOR/SUPPLIER/JUROR，现前端完全没用）→ 接角色菜单。
- 解决 **x402/escrow 链不一致**（facilitator 默认 Base Sepolia，escrow 在 Ethereum Sepolia）：自托管 facilitator 或对齐链。
- `agent-mock` CLI → 正式后端服务（并入 NestJS `aastar` 后端）。

**融汇新能力**：per-community xPNTs 奖励 + credibility 徽章；gasless UserOp；ERC-8004 `AgentRegistry`/`isRegisteredAgent` 门控自动化任务 agent；x402 走 `@aastar/x402` canonical。

### 2.2 MyShop（合约复用，前端重建）

**复用**：`MyShops`/`MyShopItems`/`sales/*`/`actions/*` 合约（部署 + `registry` 指向 AAStar Registry，owner/signer → Safe/AirAccount）；Worker 的 SerialPermit/RiskAllowance 签名方案**当 spec**。

**重建**：整个前端（Vite vanilla JS 4015 行手搓 DOM → Cos72 `app/shop/*` React 组件）；Worker 进程重托管（并入 NestJS 或真 CF Worker）；**permit signer 私钥迁进 KMS**（现在是 env 明文）。

**重构**：所有写（registerShop/addItem/buy/approve）→ AirAccount+SDK gasless UserOp；MyShops shopRoles bitmap + Registry ROLE_COMMUNITY → 角色菜单；aPNTs/GToken 售卖 + 商品定价绑社区 xPNTs + **价格预言机**（fiat→xPNTs）；部署真实地址（现全 anvil 占位）。

**融汇新能力**：xPNTs + credibility + over-issuance cap；SuperPaymaster gasless 结账；SBT membership 徽章；`getCreditLimit` 信用额度 → 先买后付（`recordDebtWithOpHash` 幂等记债）；ERC-677 `transferAndCall` 一步结账；`MicroPaymentChannel` 流式微支付。

### 2.3 MyVote（独立 app + AirAccount SSO）

**决定（jason 2026-07-10）**：保持独立 Vue app，**独立部署**（自己的站点/Cloudflare Pages，**不与 Cos72 打包**）。Cos72 侧只做一件事：**AirAccount 登录后跳转进 MyVote 部署的网站**（带 SSO token）。MyVote 内部改造照旧（建 adapter + 投票签名 + 会话）。投票权重**随大流 = 常规模式**（按社区 token 余额的标准 Snapshot strategy，不做花活）。
> ⚠️ **技术栈统一 = viem，不用 ethers.js**：MyVote 现用 ethers v5，要迁到 viem。但 `snapshot.js` `Client712.vote()` 要 ethers 签名器 → 方案：用 **viem `signTypedData` 直接产出 EIP-712 签名 + 直接 POST 到 Snapshot hub**，绕过 `Client712` 的 ethers 依赖（或最薄的 viem→ethers signer 适配）。全线统一 viem。

**现实**：AirAccount 集成是空 stub，且投票路径硬编码 window.ethereum、绕过 auth 抽象；用 **ethers v5**（非 viem），**没装 @aastar/sdk**。要从零做：
- **建真 AirAccountAdapter**（`apps/web/src/auth/airAccountProvider.ts`）：装 `@aastar/sdk`（或薄 passkey 客户端直连 `kms.aastar.io`）；`connect()`→passkey 会话→`{address}`；`signTypedData()`→AirAccount EIP-712 签名。
- **重构 `ProposalPage.vue::submitVote`**：改走 `auth.provider.signTypedData(...)`，不再裸 window.ethereum；给 `snapshot.Client712.vote()`（要 ethers 签名器）做一个 **ethers-v5 兼容 signer shim**（AA 是 viem 侧）。
- **SSO 桥**：复用 MyVote 已有的 `window.__TENANT__` 边缘注入模式 → 加 `window.__AIRACCOUNT_SESSION__`；Cos72 登录后 deep-link/token 进 MyVote，MyVote 校验后 hydrate `useAuth({address})` + **持久化会话**（现在 in-memory，刷新即掉登录）。
- **身份对齐**：Snapshot 只要「地址 + EIP-712 签名」，AirAccount 都能给；但**投票权是 Snapshot space 的 strategy 按地址算**——需确保 AA 智能账户地址（或其 owner）持有投票权 → 建议做一个**按社区 xPNTs / SBT / reputation 计权的 Snapshot strategy**。

**融汇新能力**：投票权 strategy 走社区 xPNTs 余额 / SBT / `ReputationClient` 声誉（替代通用 ERC-20）；高额提案执行走 DVT/BLS Tier-2/3 co-sign。

---

## 3. 必须「现在就吸收」的新能力（老模块几乎肯定没有）

来自基础能力走查，按价值排序：

1. **可信度 / 超发披露**（`getCredibility`、over-issuance cap，CC-33/CC-28，0.40–0.41 新）——所有涉及 xPNTs 的模块都该显示。
2. **新 DVT/BLS 地址 + 改名 `AAStarBLSKeyRegistry`**（CC-27/CC-18，v0.28）——任何硬编码旧 `AAStarBLSAlgorithm` 名/地址的都已过时。
3. **`isValidOwnerAuth 0xa0cf00cf`** off-chain owner 校验——DVT/relayer/后端验证 passkey owner 批准，不用重实现 WebAuthn。
4. **`COMMUNITY_SAFE` canonical 常量**——模块治理 owner-target，别再硬编码。
5. **token-tier 修复**（`resolveTokenTier`）——老模块自算 ERC-20 tier 边界有静默 bug，改用 SDK。
6. **SuperPaymaster gasless UserOp**——三模块「零 ETH 成本」的一行接入。
7. **Registry v3 统一 `registerRole`**——替代 v2 分散注册函数。
8. ⚠️ **x402 / ERC-8004 agent registry 仅 Sepolia 有**（OP 主网/OP-Sepolia 是 `0x0`）——agent 支付轨道目前只测试网可用。

---

## 4. 建议排期

- **Phase 0** — 共享集成层（AirAccount 会话 + SDK gasless 写路径 + canonical 地址 + 角色菜单 + 社区/xPNTs）。**三模块前置**。
- **Phase 1** — **MyTask**（UI 已 Next、合约就绪，成本最低，验证共享层）。
- **Phase 2** — **MyShop**（合约就绪，前端重建）。
- **Phase 3** — **MyVote**（独立 + 建 AirAccount adapter + SSO 桥 + 投票签名重构）。

顺序 MyTask → MyShop → MyVote（与你的直觉一致，且 MyTask 摩擦最小）。

---

## 5. 决策已定（jason 2026-07-10）

1. **链** = **Sepolia**（x402 facilitator 仅 Base 的问题 → MyTask 侧自托管 facilitator 或对齐，落地时定）。
2. **技术栈统一** = **viem**，全线不用 ethers.js（含 MyVote 迁移，见 §2.3）。
3. **过渡期集成方式** = 各模块合约**先在自己仓部署（Sepolia）→ copy ABI 进 cos72 → 部署地址写进 `.env` 配置**；调通完善后再切 `@aastar/sdk` canonical。
4. **合约部署** = 用 **SuperPaymaster / AirAccount 仓的 `env.sepolia`** + 相关部署 owner key（**jason / anni / bob**）；owner 生产收敛到 `COMMUNITY_SAFE`。
5. **SDK 缺口（TaskClient 等 primitive）= 暂缓**，过渡期先 vendored ABI + env 地址，不推 SDK。
6. **皮肤层 Phase 2/3 重写** = 同意（MyShop 前端 Phase 2 重建、MyVote Phase 3 改造）。
7. **MyVote** = 独立部署 + 登录后跳转 + 常规投票权重（见 §2.3）。
8. **后端运行时**（agent-mock / worker → NestJS vs 独立/CF）= 落地时定，非阻塞。
9. **ERC-8004 = 用 SuperPaymaster 的能力**（jason 2026-07-10）。MyTask **丢弃自带的 look-alike `IERC8004ValidationRegistry`**（`tag: bytes32`/0-100，与官方不兼容），改接 **SuperPaymaster 生态 canonical ERC-8004 agent 注册表**（identity / reputation / validation，`CANONICAL_ADDRESSES` 里 Sepolia 已部署；OP 网还是 `0x0`，我们选 Sepolia 不受影响）。JuryContract 的任务打分保留，但**身份/信誉/校验记录走 SuperPaymaster ERC-8004**，slash 走 DVT/BLS（见 §6）。
   - SDK 现状：identity + reputation 有 `ERC8004Service` wrapper；**ValidationRegistry 无 SDK wrapper = 追加候选**（SDK 缺口暂缓，过渡期 vendored ABI + canonical 地址直连）。

## 6. 新增分析任务（jason 要求，进行中）

**透彻分析 MyTask/MyShop 合约 vs 基础设施合约的「重复 / 冲突 / 应改用 infra」**：
- MyTask/MyShop 的合约整体机制，是否与 **AirAccount / SuperPaymaster** 仓里的合约**重复甚至冲突**？
- 它们自己做的事（例如 MyTask 的 jury 校验/惩罚、MySBT；MyShop 的 aPNTs/GToken 铸造、permit 签名），是否**应优先改用我们的 infra 底层（KMS / DVT / SuperPaymaster）**？
- 这些 infra 能力**是否已在 `@aastar/sdk` 暴露 API**？有 → 用；无 → 追加（暂缓推 SDK，先记录缺口）。

产出：`docs/MODULES_VS_INFRA_OVERLAP.md`（独立分析报告，待 review）。已知重点嫌疑（走查初判，待深挖确认）：
- **MySBT 命名+概念撞车**：MyTask 自带 `MySBT`（TASKOR/SUPPLIER/JUROR 角色）vs SuperPaymaster `tokens/MySBT.sol`（社区 membership/mintForRole）。
- **代币铸造重复**：MyShop `sales/{APNTsSale,GTokenSale}` 自铸 aPNTs/GToken（GToken 还硬编码 21M cap）vs 生态 canonical `GToken`/`xPNTsFactory`——可能**冲突**。
- **Jury 校验/惩罚 vs DVT/BLS**：MyTask `JuryContract` 自建质押投票+slashing vs SuperPaymaster `DVTValidator`/`BLSAggregator` + ERC-8004 agent 校验注册表。
- **Permit 签名密钥 vs KMS**：MyShop worker 用 env 明文私钥签 SerialPermit/RiskAllowance → 应迁 KMS。
