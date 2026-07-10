# Cos72 — 会话交接 / HANDOFF

> **START HERE（新会话）**：在 `~/Dev/aastar/cos72` 开新会话，先读完本文档即可无缝接手。今天完整对话原始记录也在 `~/.claude/projects/-Users-jason-Dev-aastar-cos72/`（`flycc --resume` 或许能选到，但 `-c` 不认复制的会话，以本文档为准）。
>
> 这份文档是给**新的 Claude Code 会话**接手用的（在 `~/Dev/aastar/cos72` 开新会话即可无缝续上）。
> 记录时间：2026-07-11。配套细节文档：`docs/{MODULES_REFACTOR_DESIGN,MODULES_VS_INFRA_OVERLAP,PHASE0_SHARED_LAYER}.md`。

---

## 0. Cos72 是什么（模型）

**Cos72 = YetAnotherAA(YAA) 的 fork = 链上合约的「皮肤层」**（经 `@aastar/sdk` 封装）。
- **不是多租户，人人平等**；登录后**按账户的链上角色**（SP-v5 role / community）看到不同菜单。社区/任务/积分/兑换/投票都是**链上对象**，Cos72 只渲染。
- **YAA 全部成熟页面原封不动继承**（dashboard/transfer/tasks/operator…）。新东西建在 YAA 的 `Layout`+设计系统里，不另起裸页。
- 底层 = **SDK → 合约 + Infra（KMS + DVT；relay/x402 facilitator 挂在 DVT 节点下）**。
- **self-host 第一**：填好 RPC 就能下载 cos72 自运行、零外部依赖；母站提供兜底运营（收 aPNTs，可社区贡献换积分）。
- **cos72 = YAA + 三大核心模块**：MyTask / MyShop / MyVote（源码在 `~/Dev/mycelium/{MyTask,MyShop,MyVote}`，是真实全栈项目，**远未产品化**，cos72 做**集成 + 深度优化**，可改合约/重建界面）。

---

## 1. 仓库 / 分支 / PR / 服务 现状

- **仓库**：`AAStarCommunity/Cos72`（本地 `~/Dev/aastar/cos72`）。= YAA seed，`upstream` remote = `AAStarCommunity/YetAnotherAA`（`git fetch upstream && git merge upstream/master` 同步基座）。
- **老 Cos72**（Superhack SPA）已 transfer 给 `jhfnetboy/CoS72-legacy`；本地备份 `~/Dev/backup/cos72-superhack-legacy`。
- **npm workspaces monorepo**：`aastar/`（NestJS 后端 :3000）+ `aastar-frontend/`（Next 前端 :5173）。
- **⚠️ 装依赖必须 `npm install`**（`.npmrc` 已设 `legacy-peer-deps=true`）——见 §5 gotcha。
- **工作流（jason 定）**：**一律 branch → 本地测(type-check+build) → 开 PR → jason review approve → rebase-merge**。不往 master 直提。建 PR 用 `gh api repos/AAStarCommunity/Cos72/pulls`（`gh pr create` 的 GraphQL 会发空 sha，用 REST）。合并 `gh api -X PUT .../pulls/N/merge -f merge_method=rebase`。

**PR 进度**：
| PR | 内容 | 状态 |
|---|---|---|
| #1 | 0.0 SDK 0.41 bump + react-hoist 修 + 0.2 cosTx + 0.3 addresses | ✅ merged |
| #2 | 0.1 会话 useCos72Session + 0.5 community credibility + /phase0 页 | ✅ merged |
| #3 | 0.4 GitHub 三层导航 CommunityNav + lib/roles + EOA 分层 | ✅ merged |
| #4 | 后端 src/userop/* 通用 gasless UserOp（全 tier passthrough）| ✅ merged |
| #5 | 前端 cosSend 全 tier 统一 + 轮询 | ✅ merged |
| #6 | fix: /phase0 演示页套进 YAA Layout + 样式 | ✅ merged |
| #7 | feat: 无登录 infra 初始化页(社区节点 onboarding, CC-40) | ✅ merged |

**分支**：`fix/phase0-page-yaa-shell`(=PR6)；`feat/phase1-mytask-cossend`（基于 PR6，含 1 个已 commit：会话挂全局 layout.tsx；**未推、未 PR**，等 TaskContext 重构一起）。

**本地 dev server**：`npm run dev -w aastar-frontend -- -p 5174`（跑在 :5174，不碰线上 :5173/后端 :3000）。看 http://localhost:5174/phase0 = Phase 0 成果页。**注意：切 git 分支会改工作树，dev server 服的是工作树——别切到不含 PR6 样式的分支，否则 /phase0 退回裸版。**

---

## 2. 锁定决策（jason 拍板，开发前提）

1. **链 = Sepolia**。技术栈**统一 viem，弃 ethers**（MyVote 也迁）。
2. **不兼容 EOA 分层**：**用户层 = AirAccount-only**（模块/转账/任务/商店/投票，无 window.ethereum fallback）；**infra/operator 层 = EOA**（operator 部署、DVT-register、infra 初始化——infra 参与者没 AirAccount，用 EOA 部署密钥）。YAA 现有 operator EOA 轨道（`WalletContext`/`lib/sdk/operator.ts`）保留，`useCos72Session`(AirAccount)只服务用户模块。
3. **配置策略**：KMS/DVT = 用 SDK 默认（生态锁定）；bundler/RPC = 用户自配 or 用母站（用母站需 KMS api-key，server-only）。**auth 并入 `kms.aastar.io`**（无独立 auth.aastar.io；`/kms/create-agent-key` 签发 agent-key Bearer JWT）。
4. **过渡期集成**：模块合约先各仓部署(Sepolia)→copy ABI 进 cos72→地址写 `.env.local`→调通后再切 SDK canonical。**SDK 缺口暂缓**（不推 SDK；沉淀后再提）。
5. **合约部署**：用 SuperPaymaster 仓 `.env.sepolia` 的 `DEPLOYER_PRIVATE_KEY`/`PRIVATE_KEY_{JASON,ANNI,SUPPLIER}`/`SEPOLIA_RPC_URL`/`ETHERSCAN_API_KEY`；owner 稳定后 transferOwnership 给 `COMMUNITY_SAFE`（=`SAFE_SEPOLIA_MULTISIG`）。
6. **导航 = 仿 GitHub 三层**：L1 用户菜单(跨社区,沿用 YAA 右上,不动) / L2 社区菜单(横向 tab=模块 MyTask/MyShop/MyVote+概览/成员/治理,按角色显隐) / L3 模块子导航。角色 flag 只驱动 UI 显隐，**enforcement 在链上合约**。
7. **模块↔infra 重复/冲突（见 OVERLAP.md）**：**MyTask 删自定义 MySBT 用生态 SBT**；**ERC-8004 用 SuperPaymaster** canonical 注册表；**Jury 质押/惩罚复用 DVT**（需 proposal/jury重构→提需求给 sp CC）；**MyShop 停自铸 GToken/aPNTs → xPNTsFactory 发 xPNTs**；**permit 明文私钥 → KMS agent-key 签名**；治理单 EOA → 多签/DVT。
8. **MyTask credit purchase = 生态内 xPNTs 信用透支购物**（非 gas 垫付）：复用 `getCreditLimit`+`recordDebtWithOpHash`+部分新写；**已发 CC 任务 `d50b88b0` @repo:sp** 调研+复核 SP 信用系统安全项。
9. **MyVote**：独立部署（不打包），登录后 AirAccount SSO 跳转；常规投票权重。**「已集成 AirAccount」是假的**（空 stub，投票路径硬编码 window.ethereum，ethers v5，没装 @aastar/sdk）→ 独立+SSO 是从零建 adapter+桥。
10. **移动 = Flutter**（未来或 RN）；**FangPay = 极简支付皮肤**（仅设计文档 `~/Dev/jhfnetboy/FangPay`+`~/Dev/Brood/research/fangpay`，无实现）。

---

## 3. Phase 0 = 共享集成层（**已完成**，PR#1-5 merged）

`docs/PHASE0_SHARED_LAYER.md` 是蓝图。六件套：
- **0.0** `@aastar/sdk` 0.41（`getCredibility`/`COMMUNITY_SAFE`/token-tier 修复）。
- **0.1** `contexts/Cos72SessionContext.tsx` `useCos72Session()`：`address`(AirAccount)/`isConnected`/`send`(=cosSend)。AirAccount-only。**已挂全局**（`app/layout.tsx`，在 feat/phase1 分支）。
- **0.2** `lib/sdk/cosTx.ts` `cosSend`（全 tier：resolveTransfer 定 tier→prepare→`!publicKeyOptions` 分 T1(KMS credential)/T2-3(deviceWebAuthn)→T3 guardian→submit→DVT-pending 重提→轮询 `/userop/status` 拿 txHash）+ `cosRead`。`lib/webauthn-assert.ts`（assertUserOpHash/collectGuardianSignature/runDvtConfirmation，从转账页抽出）。后端 `aastar/src/userop/*`（passthrough 复用 `client.transfers.*`，全 tier；JWT→account 绝不信 body 地址）。
- **0.3** `lib/addresses.ts` `infraAddresses()`（全 SDK canonical）+ `config/modules.ts`（模块地址 env 过渡）。
- **0.4** `components/nav/CommunityNav.tsx`（L2 三层导航）+ `lib/roles.ts`。
- **0.5** `lib/community.ts`（listCommunityTokens/readCredibility）。

**写路径信任边界（PR#1 review note）**：cosSend 盲签后端返回的 userOpHash（浏览器无法独立重算）→ 绑定只与后端一样可信。inherent to KMS-server-only；已写进 cosTx.ts 文档。

---

## 4. Phase 1 = MyTask 集成（**进行中**）

**目标**：在 YAA 成熟的 `app/tasks` 页面上，把 window.ethereum 写路径换成 `cosSend`。

**已做**：
- ✅ 会话挂全局（`app/layout.tsx`，feat/phase1 分支已 commit，未推）。
- ✅ **MyTask 合约已部署 + verified 到 Sepolia**（用 SP deployer `0xb560…df0E`，脚本 `~/Dev/mycelium/MyTask/contracts/script/DeploySepolia.s.sol`——env 驱动、非 anvil 硬编码 key；未 commit 到 MyTask 仓）：
  - **TaskEscrowV2** `0x421b4d66c82cef6432dfe340208487f27bae8011`
  - **JuryContract** `0xa3e6d98b992bcf31be0d1af4670c675264005fa8`
  - **MySBT**（生态 canonical，传进 JuryContract）`0x4867B4302bf4C7818b71F55E53A3520Ee1855Aa7`
  - **RewardToken**（mock USDC 6dec）`0x959f87797f54b5fcf8fc9d8f7f7cf4f1881c8e36`
  - StakingToken（mock xPNT 18dec）`0x02a24816524e02149180bc4deecc1dc0d042ff75`
  - 已写进 `aastar-frontend/.env.local`（gitignored）。
- ✅ **permit 洞察（jason）**：xPNTs 奖励**无需 approve**（xPNTs 工厂已把 spender auto-approve，只要 TaskEscrow 在 `xPNTsToken.autoApprovedSpenders`）→ createTask 单 op。**当前用的是 mock USDC（要 approve，2 ops）**——先 e2e 跑通，之后换真 xPNTs + `addAutoApprovedSpender(taskEscrow)`（需该 xPNTs token 的 communityOwner/FACTORY 权限）即变 1 op。

**下一步（未做，就是接手要干的）**：
1. **TaskContext + tasks 页 cosSend 重构**（一个 PR）：
   - `contexts/TaskContext.tsx` 8 个写函数（approveToken/createTask/acceptTask/submitWork/approveWork/finalizeTask/cancelTask/linkReceipt）签名 `walletClient: WalletClient` → `send: (call)=>Promise<Hash>`（cosSend）。每个 `walletClient.writeContract({address,abi,functionName,args})` → `send({to:address,abi,functionName,args})`，去掉 `requestAddresses`（cosSend 用会话账户）。createTask 保留 `waitForTransactionReceipt` 取 taskId。
   - `app/tasks/{create,[taskId]}/page.tsx` + `page.tsx`：去掉自建 `window.ethereum` walletClient，改 `const { send } = useCos72Session()` 传进去。
   - **create 页去掉 EIP-2612 permit**（AA 不能 EOA 直签 typed-data permit）：mock USDC 阶段用 `approveToken(send)`+`createTask(send)`（2 gasless op）；换 xPNTs 后去掉 approve（1 op）。x402 那段（`postTaskWithX402`）评估保留/改。
   - 地址从 `config/modules.ts`/`task-config.ts` 读（已配 .env.local）。
   - 每步 type-check + build 绿再 PR。
2. **真跑测试**：dev :5174 + 起 cos72 后端（`npm run start:dev -w aastar`，需 `/userop` = 已在 #4）+ 配 RPC/KMS。登录→建任务→接单→提交→完成 走 cosSend gasless。
3. 之后：Phase 2 MyShop（前端重建）、Phase 3 MyVote（独立+SSO）。

---

## 5. 关键 gotcha（会再踩）

- **装依赖**：@aastar/sdk 0.41 peerOptional react ^18 vs app react 19 → 干净 `npm install` ERESOLVE 失败。**已修**：root `.npmrc` `legacy-peer-deps=true` + react/react-dom 进 root `devDependencies`（强制 hoist 到 root，否则 `next build` 报 `Cannot find module 'react'`）。fresh clone 直接 `npm install` 即可。
- **验构建成败**：后台 `cmd | tail` 的 exit code 是 tail 的、不是 cmd 的。用 `cmd > log 2>&1; echo $?` 单独取码（曾误判 build 绿）。
- **建 PR**：`gh pr create` GraphQL 发空 sha 报错 → 用 `gh api repos/AAStarCommunity/Cos72/pulls -f title=.. -f head=.. -f base=master -F body=@file`。
- **macOS 大小写不敏感**：`Cos72`==`cos72` 同一路径，`rm`/`mv` 会误伤——避免只差大小写的路径。
- **dev server 服工作树**：切 git 分支会改前端外观（见 §1）。
- **⚠️ @aastar/sdk 0.42 /operator 泄 child_process**：0.42 的 `/operator` 子包有个 Foundry-CLI 签名路径 `await import('child_process')`(node-only)会泄进浏览器 bundle → `next build` 报 `Can't resolve child_process`。**修法(PR#7 已加)**：`next.config.ts` `turbopack.resolveAlias.child_process → ./stubs/empty.ts`。**应报 repo:sdk 让 SDK node-guard 该路径**(0.41 无此问题)。
- **合约部署**：`~/Dev/mycelium/MyTask/contracts/script/DeployLocal.s.sol` **硬编码 anvil burn key，别对 Sepolia 跑**；用新写的 `DeploySepolia.s.sol`（env 驱动）。forge 1.7.1，solc auto ^0.8.23（部署实际用了 0.8.33），forge-std 在、无 OZ。

---

## 6. 记忆/外部引用

- 全局记忆（不在本仓，在 `~/.claude/.../memory/cos72-multicommunity-evolution-vision.md`）有更细的演进史。
- 协同中枢（Seeder MCP）项目 `03253073-c822-4a5a-b169-cb39976200c3`；CC 任务 `d50b88b0`(@sp credit purchase 调研) 待回。
- 基础仓库本地：`~/Dev/aastar/{aastar-sdk,airaccount-contract,AirAccount(KMS),SuperPaymaster,YetAnotherAA-Validator(DVT)}`；模块 `~/Dev/mycelium/{MyTask,MyShop,MyVote}`。
- 部署 key/RPC/etherscan：`~/Dev/aastar/SuperPaymaster/.env.sepolia`。
