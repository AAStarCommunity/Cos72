# Cos72 — 会话交接 / HANDOFF

> **START HERE（新会话）**：在 `~/Dev/aastar/cos72`
> 开新会话，先读完本文档即可无缝接手。今天完整对话原始记录也在
> `~/.claude/projects/-Users-jason-Dev-aastar-cos72/`（`flycc --resume`
> 或许能选到，但 `-c` 不认复制的会话，以本文档为准）。
>
> 这份文档是给**新的 Claude Code 会话**接手用的（在 `~/Dev/aastar/cos72`
> 开新会话即可无缝续上）。记录时间：2026-07-11，**§1 与 §1b 于 2026-07-14 更新**。配套细节文档：`docs/{MODULES_REFACTOR_DESIGN,MODULES_VS_INFRA_OVERLAP,PHASE0_SHARED_LAYER}.md`。
>
> **⭐ 执行看板以 `docs/MODULES_INTEGRATION_PLAN.md`
> 为准**（A/MT/MS/MV/E 五线任务编号 + 里程碑 + 逐项状态）。本文档 §1b 是 2026-07-14 会话的高层快照；细粒度进度看 PLAN。

---

## 0. Cos72 是什么（模型）

**Cos72 = YetAnotherAA(YAA) 的 fork = 链上合约的「皮肤层」**（经 `@aastar/sdk`
封装）。

- **不是多租户，人人平等**；登录后**按账户的链上角色**（SP-v5 role /
  community）看到不同菜单。社区/任务/积分/兑换/投票都是**链上对象**，Cos72 只渲染。
- **YAA 全部成熟页面原封不动继承**（dashboard/transfer/tasks/operator…）。新东西建在 YAA 的
  `Layout`+设计系统里，不另起裸页。
- 底层 = **SDK → 合约 + Infra（KMS + DVT；relay/x402
  facilitator 挂在 DVT 节点下）**。
- **self-host 第一**：填好 RPC 就能下载 cos72 自运行、零外部依赖；母站提供兜底运营（收 aPNTs，可社区贡献换积分）。
- **cos72 = YAA + 三大核心模块**：MyTask / MyShop / MyVote（源码在
  `~/Dev/mycelium/{MyTask,MyShop,MyVote}`，是真实全栈项目，**远未产品化**，cos72 做**集成 + 深度优化**，可改合约/重建界面）。

---

## 1. 仓库 / 分支 / PR / 服务 现状

- **仓库**：`AAStarCommunity/Cos72`（本地 `~/Dev/aastar/cos72`）。= YAA
  seed，`upstream` remote =
  `AAStarCommunity/YetAnotherAA`（`git fetch upstream && git merge upstream/master`
  同步基座）。
- **老 Cos72**（Superhack SPA）已 transfer 给 `jhfnetboy/CoS72-legacy`；本地备份
  `~/Dev/backup/cos72-superhack-legacy`。
- **npm workspaces monorepo**：`aastar/`（NestJS 后端 :3000）+
  `aastar-frontend/`（Next 前端 :5173）。
- **⚠️ 装依赖必须 `npm install`**（`.npmrc` 已设
  `legacy-peer-deps=true`）——见 §5 gotcha。
- **工作流（jason 定）**：**一律 branch → 本地测(type-check+build) → 开 PR →
  jason review approve → rebase-merge**。不往 master 直提。建 PR 用
  `gh api repos/AAStarCommunity/Cos72/pulls`（`gh pr create`
  的 GraphQL 会发空 sha，用 REST）。合并
  `gh api -X PUT .../pulls/N/merge -f merge_method=rebase`。

**PR 进度**：Phase 0 六件套(#1-6) + infra onboarding(#7) 均 ✅ merged（Phase
0 共享层 =
A-1）。**#8 起的完整 merge/open 列表见 §1b（2026-07-14 更新）**，逐项任务状态见
`MODULES_INTEGRATION_PLAN.md`。

**本地 dev
server**：`npm run dev -w aastar-frontend -- -p 5174`（跑在 :5174，不碰线上 :5173/后端 :3000）。**注意：切 git 分支会改工作树，dev
server 服的是工作树。**

---

## 1b. 2026-07-14 会话进展快照（细粒度看 `MODULES_INTEGRATION_PLAN.md`）

**已 merge（本会话）**：Cos72 #8(Phase1 MyTask cosSend) · #9(e2e paymaster
canonical) · #10(CI 基线：prettier + react-hooks 钉 7.0.1) · #11(集成计划总表) ·
#12(CLAUDE.md 入仓) · #14(A-8 共享 indexer 基建) · #15/#17(看板回填)；MyTask
#9(P0 资金安全：jury 分成黑洞 + challengeWork ERC-20 质押) · #10(MT-5 删死路径)
· #11(MT-4 canonical SBT) · #12(MT-8 broadcast)；MyShop #4(MS-1 设计稿)。

**链上（Sepolia，MT-8 重部署，4 合约 verified）**：TaskEscrowV2
`0x171234DD282eF2909ec20dafC3F81deBa6761178` · JuryContract
`0x63f38d996d5D2784Da135f1B8B164c97a71e0161` · MySBT=生态 canonical
`0x4867B4302bf4C7818b71F55E53A3520Ee1855Aa7`（未再自铸）· StakingToken(xPNT)
`0xDbdaa6793e4F1b856baA7F8fd84F2E6aEE69ab09` · RewardToken(USDC mock)
`0x96C74b26ee4b7b57d576cf97b773906Cc7EE4E5B`。**旧部署（jury 黑洞 +
ETH 质押）已弃用**。cos72 `.env.local` 已切新地址。

**待 review / merge 的 open PR（7）**：

| PR              | 内容                                                                            | codex      |
| --------------- | ------------------------------------------------------------------------------- | ---------- |
| Cos72 #16       | MT-11 challenge/仲裁前端                                                        | 2 轮       |
| Cos72 #18 → #19 | MV-1 SSO 端点 → MV-7 授权发起页（栈；**合前必配 `SSO_JWT_SECRET`，fail-fast**） | 3 轮安全审 |
| Cos72 #20       | A-8 indexer 首个消费方（MyTask 挑战事件索引）                                   | 2 轮       |
| MyShop #5 → #6  | MS-1 停自铸迁 xPNTs → MS-2 部署脚本（栈）                                       | 2 / 1 轮   |
| MyVote #4       | MV-2/3/4 AirAccount SSO + 投票脱离 ethers/snapshot.js                           | 4 轮安全审 |

**待 jason 决策/确认（阻塞后续）**：

1. 上述 7 PR 的 merge。
2. **MS-2 上链三问**：deployer 是否有 ROLE_COMMUNITY /
   TREASURY 用 deployer 还是多签 / 用哪个社区的 xPNTs（`XPNTS_TOKEN_ADDRESS`）。答后一条命令上链（同 MT-8 流程）。
3. **MyTask#9 产品三问**（下轮合约迭代）：`linkJuryValidation`
   罚没方向是否本意（现 jury 否决→质押罚给 taskor）/ 未挑战任务 10% jury
   share 归 `ownerDust` 还是 feeRecipient / `linkJuryValidation`
   可传任意 COMPLETED jury hash 无绑定（既有漏洞）。
4. **Seeder MCP 重连**（`/mcp`）：E-2（MyTask
   Jury 质押/惩罚复用 DVT，派 repo:sp+repo:dvt）文案就绪但 Seeder
   POST 一直失败，未发出。E-5（KMS signTypedData+SSO，repo:kms）已派（task
   `74fe4153`）。

**D 线 SSO 链路状态**：cos72 端点(#18)✅ + 授权发起页(#19)✅ + MyVote
adapter/投票(#4)✅，**只差 E-5 KMS `signTypedData`**（接口已定
`kms.ts`、两端调用点已接好，到位换实现即真机可投票）。契约：cos72
`SSO_ALLOWED_REDIRECTS` 精确登记 `https://<myvote域>/sso/callback` 一条。

**MyVote 本地注意**：切分支时有未提交的 `CLAUDE.md` 改动被 agent
stash（`stash@{0}`），本地 `main` 有未推送 commit 与 origin 分叉——合 PR 前先理。

---

## 2. 锁定决策（jason 拍板，开发前提）

1. **链 = Sepolia**。技术栈**统一 viem，弃 ethers**（MyVote 也迁）。
2. **不兼容 EOA 分层**：**用户层 =
   AirAccount-only**（模块/转账/任务/商店/投票，无 window.ethereum
   fallback）；**infra/operator 层 =
   EOA**（operator 部署、DVT-register、infra 初始化——infra 参与者没 AirAccount，用 EOA 部署密钥）。YAA 现有 operator
   EOA 轨道（`WalletContext`/`lib/sdk/operator.ts`）保留，`useCos72Session`(AirAccount)只服务用户模块。
3. **配置策略**：KMS/DVT = 用 SDK 默认（生态锁定）；bundler/RPC
   = 用户自配 or 用母站（用母站需 KMS api-key，server-only）。**auth 并入
   `kms.aastar.io`**（无独立 auth.aastar.io；`/kms/create-agent-key`
   签发 agent-key Bearer JWT）。
4. **过渡期集成**：模块合约先各仓部署(Sepolia)→copy ABI 进 cos72→地址写
   `.env.local`→调通后再切 SDK
   canonical。**SDK 缺口暂缓**（不推 SDK；沉淀后再提）。
5. **合约部署**：用 SuperPaymaster 仓 `.env.sepolia` 的
   `DEPLOYER_PRIVATE_KEY`/`PRIVATE_KEY_{JASON,ANNI,SUPPLIER}`/`SEPOLIA_RPC_URL`/`ETHERSCAN_API_KEY`；owner 稳定后 transferOwnership 给
   `COMMUNITY_SAFE`（=`SAFE_SEPOLIA_MULTISIG`）。
6. **导航 = 仿 GitHub 三层**：L1 用户菜单(跨社区,沿用 YAA 右上,不动) /
   L2 社区菜单(横向 tab=模块 MyTask/MyShop/MyVote+概览/成员/治理,按角色显隐) /
   L3 模块子导航。角色 flag 只驱动 UI 显隐，**enforcement 在链上合约**。
7. **模块↔infra 重复/冲突（见 OVERLAP.md）**：**MyTask 删自定义 MySBT 用生态 SBT**；**ERC-8004 用 SuperPaymaster**
   canonical 注册表；**Jury 质押/惩罚复用 DVT**（需 proposal/jury重构→提需求给 sp
   CC）；**MyShop 停自铸 GToken/aPNTs →
   xPNTsFactory 发 xPNTs**；**permit 明文私钥 → KMS agent-key 签名**；治理单 EOA
   → 多签/DVT。
8. **MyTask credit purchase = 生态内 xPNTs 信用透支购物**（非 gas 垫付）：复用
   `getCreditLimit`+`recordDebtWithOpHash`+部分新写；**已发 CC 任务 `d50b88b0`
   @repo:sp** 调研+复核 SP 信用系统安全项。
9. **MyVote**：独立部署（不打包），登录后 AirAccount
   SSO 跳转；常规投票权重。**「已集成 AirAccount」是假的**（空 stub，投票路径硬编码 window.ethereum，ethers
   v5，没装 @aastar/sdk）→ 独立+SSO 是从零建 adapter+桥。
10. **移动 = Flutter**（未来或 RN）；**FangPay = 极简支付皮肤**（仅设计文档
    `~/Dev/jhfnetboy/FangPay`+`~/Dev/Brood/research/fangpay`，无实现）。

---

## 3. Phase 0 = 共享集成层（**已完成**，PR#1-5 merged）

`docs/PHASE0_SHARED_LAYER.md` 是蓝图。六件套：

- **0.0** `@aastar/sdk`
  0.41（`getCredibility`/`COMMUNITY_SAFE`/token-tier 修复）。
- **0.1** `contexts/Cos72SessionContext.tsx`
  `useCos72Session()`：`address`(AirAccount)/`isConnected`/`send`(=cosSend)。AirAccount-only。**已挂全局**（`app/layout.tsx`，在 feat/phase1 分支）。
- **0.2** `lib/sdk/cosTx.ts`
  `cosSend`（全 tier：resolveTransfer 定 tier→prepare→`!publicKeyOptions`
  分 T1(KMS credential)/T2-3(deviceWebAuthn)→T3
  guardian→submit→DVT-pending 重提→轮询 `/userop/status` 拿 txHash）+
  `cosRead`。`lib/webauthn-assert.ts`（assertUserOpHash/collectGuardianSignature/runDvtConfirmation，从转账页抽出）。后端
  `aastar/src/userop/*`（passthrough 复用
  `client.transfers.*`，全 tier；JWT→account 绝不信 body 地址）。
- **0.3** `lib/addresses.ts` `infraAddresses()`（全 SDK canonical）+
  `config/modules.ts`（模块地址 env 过渡）。
- **0.4** `components/nav/CommunityNav.tsx`（L2 三层导航）+ `lib/roles.ts`。
- **0.5** `lib/community.ts`（listCommunityTokens/readCredibility）。

**写路径信任边界（PR#1 review
note）**：cosSend 盲签后端返回的 userOpHash（浏览器无法独立重算）→ 绑定只与后端一样可信。inherent
to KMS-server-only；已写进 cosTx.ts 文档。

---

## 4. Phase 1 = MyTask 集成（**已完成**，PR #8 merged）

**目标**：在 YAA 成熟的 `app/tasks` 页面上，把 window.ethereum 写路径换成
`cosSend`。

**已做**：

- ✅ 会话挂全局（`app/layout.tsx`，feat/phase1 分支已 commit，未推）。
- ✅ **MyTask 合约已部署 + verified 到 Sepolia**（用 SP deployer
  `0xb560…df0E`，脚本
  `~/Dev/mycelium/MyTask/contracts/script/DeploySepolia.s.sol`——env 驱动、非 anvil 硬编码 key；未 commit 到 MyTask 仓）：
  - **TaskEscrowV2** `0x421b4d66c82cef6432dfe340208487f27bae8011`
  - **JuryContract** `0xa3e6d98b992bcf31be0d1af4670c675264005fa8`
  - **MySBT**（生态 canonical，传进 JuryContract）`0x4867B4302bf4C7818b71F55E53A3520Ee1855Aa7`
  - **RewardToken**（mock USDC
    6dec）`0x959f87797f54b5fcf8fc9d8f7f7cf4f1881c8e36`
  - StakingToken（mock xPNT 18dec）`0x02a24816524e02149180bc4deecc1dc0d042ff75`
  - 已写进 `aastar-frontend/.env.local`（gitignored）。
- ✅
  **permit 洞察（jason）**：xPNTs 奖励**无需 approve**（xPNTs 工厂已把 spender
  auto-approve，只要 TaskEscrow 在 `xPNTsToken.autoApprovedSpenders`）→
  createTask 单 op。**当前用的是 mock USDC（要 approve，2
  ops）**——先 e2e 跑通，之后换真 xPNTs +
  `addAutoApprovedSpender(taskEscrow)`（需该 xPNTs
  token 的 communityOwner/FACTORY 权限）即变 1 op。

**下一步（未做，就是接手要干的）**：

1. **TaskContext + tasks 页 cosSend 重构**（一个 PR）：
   - `contexts/TaskContext.tsx`
     8 个写函数（approveToken/createTask/acceptTask/submitWork/approveWork/finalizeTask/cancelTask/linkReceipt）签名
     `walletClient: WalletClient` →
     `send: (call)=>Promise<Hash>`（cosSend）。每个
     `walletClient.writeContract({address,abi,functionName,args})` →
     `send({to:address,abi,functionName,args})`，去掉
     `requestAddresses`（cosSend 用会话账户）。createTask 保留
     `waitForTransactionReceipt` 取 taskId。
   - `app/tasks/{create,[taskId]}/page.tsx` + `page.tsx`：去掉自建
     `window.ethereum` walletClient，改 `const { send } = useCos72Session()`
     传进去。
   - **create 页去掉 EIP-2612 permit**（AA 不能 EOA 直签 typed-data
     permit）：mock USDC 阶段用 `approveToken(send)`+`createTask(send)`（2
     gasless op）；换 xPNTs 后去掉 approve（1
     op）。x402 那段（`postTaskWithX402`）评估保留/改。
   - 地址从 `config/modules.ts`/`task-config.ts` 读（已配 .env.local）。
   - 每步 type-check + build 绿再 PR。
2. **真跑测试**：dev :5174 + 起 cos72 后端（`npm run start:dev -w aastar`，需
   `/userop` = 已在 #4）+ 配 RPC/KMS。登录→建任务→接单→提交→完成 走 cosSend
   gasless。
3. 之后：Phase 2 MyShop（前端重建）、Phase 3 MyVote（独立+SSO）。

---

## 4b. x402 付费发帖 — 现状与依赖（AA-x402）

**定位**：MyTask 发任务前的可选「付费发帖」微支付门控，**非**奖励托管（奖励 escrow 已 gasless 走通）。PR
#8 里从 create 流程移除了旧的 EOA x402（EIP-3009，AA 签不了）。

**AA-x402 技术上可建**：

- SDK `@aastar/sdk/x402`：`signX402PaymentAuthorization` /
  `X402Client({settlement:'direct'})` ——
  direct 路径用 ERC-1271（`SignatureCheckerLib.isValidSignatureNow`），支持 AirAccount
  passkey。
- cos72 后端已有 KMS `signHashWithWebAuthn(address, hash)`
  → 出 AA 的离线 ERC-1271 签名。

**卡在两个依赖（都未就绪）**：

1. **X402Facilitator 合约 +
   facilitator 服务**（`/x402/{verify,settle,supported}`）——
   DVT 运营，SDK 注释「empty until DVT
   deploys（YAA-Validator#130）」。已发 goutou 任务 `f14d3f9b`
   @repo:dvt 问 Sepolia 部署状态。
2. **任务 x402 API server 要支持 direct scheme**（现走 EIP-3009 = EOA-only）——
   server owner 改。

**决策（jason）**：#8 先 merge（不含 x402）；AA-x402 等 dvt facilitator 解锁 +
API server 支持 direct 后，开独立 PR（KMS SignHash→ERC-1271→X402Client
direct）。cos72 用 xPNTs 付费 = 天然 direct 路径。

---

## 5. 关键 gotcha（会再踩）

- **后端 e2e 有 1 个陈旧断言（非本次引入）**：`aastar/test/app.e2e-spec.ts:9`
  硬编码 `CANONICAL_PAYMASTER_V4=0x9578…72ee`，但 SDK 0.42 canonical 已是
  `0xf394…fa0e` → e2e 14/15，这条红。SDK 0.42
  bump(PR#7)引入，测试没跟更新。修法：把硬编码改成 SDK 常量 import。单测 41/41、type-check/build 全绿。

- **装依赖**：@aastar/sdk 0.41 peerOptional react ^18 vs app react 19 → 干净
  `npm install` ERESOLVE 失败。**已修**：root `.npmrc` `legacy-peer-deps=true` +
  react/react-dom 进 root `devDependencies`（强制 hoist 到 root，否则
  `next build` 报 `Cannot find module 'react'`）。fresh clone 直接 `npm install`
  即可。
- **验构建成败**：后台 `cmd | tail` 的 exit code 是 tail 的、不是 cmd 的。用
  `cmd > log 2>&1; echo $?` 单独取码（曾误判 build 绿）。
- **建 PR**：`gh pr create` GraphQL 发空 sha 报错 → 用
  `gh api repos/AAStarCommunity/Cos72/pulls -f title=.. -f head=.. -f base=master -F body=@file`。
- **macOS 大小写不敏感**：`Cos72`==`cos72` 同一路径，`rm`/`mv`
  会误伤——避免只差大小写的路径。
- **dev server 服工作树**：切 git 分支会改前端外观（见 §1）。
- **⚠️ @aastar/sdk 0.42 /operator 泄 child_process**：0.42 的 `/operator`
  子包有个 Foundry-CLI 签名路径
  `await import('child_process')`(node-only)会泄进浏览器 bundle → `next build`
  报 `Can't resolve child_process`。**修法(PR#7 已加)**：`next.config.ts`
  `turbopack.resolveAlias.child_process → ./stubs/empty.ts`。**应报 repo:sdk 让 SDK
  node-guard 该路径**(0.41 无此问题)。
- **合约部署**：`~/Dev/mycelium/MyTask/contracts/script/DeployLocal.s.sol`
  **硬编码 anvil burn key，别对 Sepolia 跑**；用新写的
  `DeploySepolia.s.sol`（env 驱动）。forge 1.7.1，solc auto
  ^0.8.23（部署实际用了 0.8.33），forge-std 在、无 OZ。

---

## 6. 记忆/外部引用

- 全局记忆（不在本仓，在
  `~/.claude/.../memory/cos72-multicommunity-evolution-vision.md`）有更细的演进史。
- 协同中枢（Seeder MCP）项目 `03253073-c822-4a5a-b169-cb39976200c3`；CC 任务
  `d50b88b0`(@sp credit purchase 调研) 待回。
- 基础仓库本地：`~/Dev/aastar/{aastar-sdk,airaccount-contract,AirAccount(KMS),SuperPaymaster,YetAnotherAA-Validator(DVT)}`；模块
  `~/Dev/mycelium/{MyTask,MyShop,MyVote}`。
- 部署 key/RPC/etherscan：`~/Dev/aastar/SuperPaymaster/.env.sepolia`。
