# Cos72 平台化演进 — 深度评估与方案（v2，按 jason 修正重写）

> v2 修正（2026-07-10，jason 反馈）：
> - **A**：cos72 弃用旧 SPA，**重建为 YAAA 的 fork**，搭三大模块 MyVote(snapshot 改版)/MyShop/MyTask；create-cos72-dapp 是早期实验，吸取经验后重建。
> - **B**：可嵌入线分工 = **SDK 供底层组件，cos72 做集成方案**（cos72 提诉求）。
> - **C**：**一个"登录后按账户看不同菜单"的系统，无多租户、人人平等，本质是链上合约的皮肤层**（经 SDK 封装），依赖 KMS/DVT infra。→ v1 的"多租户子域"作废。
> - **D**：registry 废弃（旧 SuperPaymaster portal，设计已并入 YAAA）；其他仓库辅助。

---

## 0. 修正后的核心模型（一句话）

**cos72 = YAAA 的 fork = 链上合约的"皮肤层"**。同一份 app，**人人平等、无多租户**；你看到什么菜单，由**你账户的链上角色**决定（读 SuperPaymaster v5 role/community）。所有"社区""任务""积分""兑换""投票"都是**链上对象**，cos72 只是把它们渲染出来（经 @aastar/sdk 封装）。

**由此推出一个统一的架构洞察**：既然 cos72 是"SDK + 合约"之上的一层皮肤，那么**所有分发形态（Web / Chrome 扩展 / create-app / 可嵌入 widget / 移动 / FangPay）本质都是同一套 SDK+合约的不同皮肤**。→ **SDK 层是唯一的杠杆点**；cos72 负责"把皮肤组装出来（集成）"，SDK 负责"出底层组件"。这与 B、C 完全吻合。

```
              ┌──────────── 链上合约（真相源）─────────────┐
              │ SuperPaymaster v5: role/community/SBT/xPNTs │
              │ TaskEscrow · AirAccount factory/validator   │
              └───────────────────┬────────────────────────┘
                                  │ 经 ↓ 封装
              ┌───────────────────▼────────────────────────┐
              │ @aastar/sdk (browser-safe, headless)        │
              │ airaccount(passkey) enduser(余额/gasless)   │
              │ tokens(xPNTs) community · +新增底层组件      │
              └───────────────────┬────────────────────────┘
   都是同一套 SDK+合约的"皮肤"  ↓（cos72 负责集成/组装）
   ┌──────────┬──────────┬──────────┬──────────┬───────────┐
   │ cos72 Web │ Chrome扩展│ create-app│ 嵌入widget│ 移动/FangPay│
   │(fork YAAA)│(第二前端) │(生成皮肤) │(迷你皮肤) │ (皮肤)     │
   └──────────┴──────────┴──────────┴──────────┴───────────┘
                        依赖 infra: KMS · DVT · Bundler
```

**KMS/DVT 依赖不变**：账户/签名走 KMS，Tier-2/3 聚合走 DVT，与皮肤层无关（皮肤只是 UI + SDK 调用）。

---

## 1. cos72 = YAAA 的 fork（架构决策 A）

**为什么 fork 而不是在 YAAA 里加**：
- YAAA 是**账户抽象基座**（passkey/KMS/BLS/gasless/tier + 已有 TaskEscrow），应保持精简、可被别的项目直接用。
- cos72 是**社区操作系统**（= MyTask + MyVote + MyShop，Mycelium 生态官方定位），在 YAAA 之上加社区模块。
- fork 让 cos72 独立演化社区模块，同时**周期性 rebase/merge YAAA 的账户/infra 更新**（passkey/KMS/gasless/SDK 升级）。

**fork 边界（cos72 从 YAAA 继承 vs 新增）**：

| 层 | 来自 YAAA（继承，随上游更新）| cos72 新增（社区 OS）|
|---|---|---|
| 账户 | passkey 注册/登录、KMS 签名、tier、gasless 转账、建号 | — |
| 任务 | **TaskEscrow 模块（`app/tasks/*`+`TaskContext`，已是真链上）** | **MyTask** = 在此之上做社区任务 UX（发布/领取/审批/兑奖 + 社区作用域）|
| 积分 | xPNTs 买入页（`app/tokens`，PR#357）| 社区积分在三模块里的奖励/兑换/权重语义 |
| **基础 portal（jason 修正：留 YAAA 维护）** | **注册社区 / 加入 / stake / 注册 SuperPaymaster / 治理配置** —— 这些是"账户+基建"portal，YAAA 维护，cos72 rebase 继承不改 | cos72 只做**入口聚合 + 角色菜单**，把这些 portal 挂进社区视图 |
| 兑换 | — | **MyShop**（集成 `~/Dev/mycelium/MyShop`）|
| 投票 | — | **MyVote**（集成 `~/Dev/mycelium/MyVote`，Snapshot fork）|
| 皮肤 | 现硬编码品牌 | 品牌配置层 + 三模块统一皮肤（**界面风格一致 + 保障 AirAccount 登录**）|

> **分工边界（jason 修正定稿）**：**YAAA = 基座**（AirAccount + SuperPaymaster + 基础 portal：注册社区/注册 SP/stake/治理），这些流程**留在 YAAA 维护**。**cos72（fork）= 专注三模块（MyTask/MyShop/MyVote）+ 更多应用 + 4 种分发场景**，rebase 继承 YAAA 基座。集成三模块的硬要求：**① 界面风格一致 ② 保障 AirAccount 登录打通**。

## 1.5 仓库策略 + 目录结构 + 配置/端点模型（jason 定稿）

### 仓库策略（老 Cos72 保留备份 + 新建 YAAA fork）
- **老 `AAStarCommunity/Cos72`（Superhack SPA）保留作备份/参考** → **改名 `Cos72-legacy`（或 transfer 给 jhfnetboy 改名 `cos72-backup`）**。代码已在 GitHub + `~/Dev/backup/`，历史安全。
- **新 cos72 = YetAnotherAA 的 fork**。
  - ⚠️ **GitHub 限制**：一个 repo **不能 fork 进它自己所属的 org**（AAStarCommunity 里 fork 自己的 YetAnotherAA 建新 repo，标准 fork 不允许）。→ **实操 = 新建 `AAStarCommunity/Cos72`（清空老的名后），用 YetAnotherAA 代码 seed + 加 `upstream` remote 指向 YetAnotherAA**。效果等同 fork：`git fetch upstream && git merge upstream/master` 就能 rebase YAAA 基座更新。
  - 若坚持真 GitHub fork 关系：fork 到 jhfnetboy 个人再 transfer 回 org，或用 fork 到别的 org。seed+upstream 更省事、无同 org 限制。

### 目录结构（cos72 演化成 monorepo，含你要的"四个目录"）
```
Cos72/  (fork/seed of YetAnotherAA, remote upstream=YetAnotherAA)
├── aastar-frontend/ aastar/   # 继承 YAAA 基座(账户/gasless/基础portal),rebase 更新,不在 cos72 改
├── config/brand.ts            # 品牌配置层(换皮),默认=cos72
├── modules/                   # 三大核心模块(集成 ~/Dev/mycelium/*)
│   ├── mytask/                #   复用 MyTask 合约+api-server(YAAA app/tasks 已是前端)
│   ├── myshop/                #   复用 MyShop 合约+worker,移植 Vite 前端进统一皮肤
│   └── myvote/                #   集成 MyVote(Snapshot fork+AirAccount),独立 app + SSO
└── apps/                      # ← 你要的"四个目录":四种分发场景
    ├── extension/             #   ① Chrome 插件(第二皮肤,管理端+用户端)
    ├── mobile/                #   ② 移动端(RN/Capacitor,复用 SDK)
    ├── embed/                 #   ③ 页面集成(两种方式:UMD `<script>` widget + React 组件包)
    └── create-app/            #   ④ create-cos72-dapp 重建(脚手架+模版)
```
每个 `apps/*` 都是"同一套 SDK+合约的一张皮肤",共用 `config/` 与 SDK。

### 配置 vs 托管服务（回答"托管公共端点是配置吗"）
**要区分两类东西**——都表现为一个 URL/地址(配置),但背后含义不同：

| 类型 | 是什么 | 谁提供 / 配在哪 |
|---|---|---|
| **合约地址** | Registry/xPNTs/SP/factory/validator... | **SDK canonical 提供**(`@aastar/sdk/core`),cos72 直接取,不手填 ✅ |
| **RPC URL** | 读链的节点 | **cos72 配置**(`.env`,本地可覆盖) ✅ 你说的对 |
| **KMS + passkey RP (`kms.aastar.io`)** | TEE 签名 + WebAuthn 登录/注册 ceremony（**auth 已并入 KMS，无独立 auth.aastar.io**；RP id=aastar.io，支持 *.aastar.io）| **SDK 默认（生态锁定，用户不配）**；用母站需 KMS api-key（server-only）|
| **DVT（+挂载服务）** | BLS 验证/slash；relay、x402 facilitator = 挂在 DVT 节点下的可加载模块 | **SDK 默认（生态锁定）** |
| **Bundler** | ERC-4337 打包 RPC | **用户可自配 or 用母站** |
| **Paymaster (SuperPaymaster)** | gasless 赞助（合约+服务）| 地址走 SDK canonical；赞助服务母站兜底 |

> **一句话（jason 定稿）**：**KMS/DVT 用 SDK 默认（生态锁定）**；**bundler/RPC 用户可自配或用母站（用母站需 KMS api-key）**。self-host 核心 = 填好自己的 RPC 即可下载 cos72 **自运行、零外部依赖**；母站提供基础运营**兜底**（成本→收 aPNTs 社区积分，可用给社区做贡献换积分）。aPNTs 支付/订阅抵扣后续再说。DVT 的 relay / x402 facilitator 挂在 DVT 节点下（可加载模块）。

**旧 `Cos72/` SPA 的处置**：弃用，但**吸取其经验**——它验证过：链上 CommunityManager 多社区模型、社区创建 Dialog 交互（NFT/points/store/goods/event）、`Embed.tsx` 浮窗、白牌首页样例。这些 UX 模式**用现代 @aastar/sdk 在 cos72 fork 里重写**，不搬旧代码（旧代码绑自研 AA SDK）。

---

## 2. 三大核心模块 —— **已存在，cos72 做集成而非新建**（实测 `~/Dev/mycelium/`）

**关键更正**：MyTask/MyShop/MyVote **不是待建，是三个真实全栈项目**（各有合约 + 后端 + 前端，只是栈不一）。cos72 的活是**统一集成**：复用它们的**合约（已部署）+ 后端服务**，把**前端在 cos72(YAAA fork) 里统一皮肤 + 统一 AirAccount 账户 + 统一社区作用域**。

### MyTask（`~/Dev/mycelium/MyTask`）— YAAA 已是它的前端
- **是什么**：基于 **x402** 的免许可任务市场，四方经济模型。合约 = **TaskEscrow(V2)/JuryContract/MySBT** + `packages/api-server` + Next 前端。
- **⚠️ 已与 YAAA 打通**：YAAA `app/tasks/*` 消费的正是这套合约（`NEXT_PUBLIC_TASK_ESCROW/JURY_CONTRACT/MYSBT/X402_API_URL`）。**即 YAAA 的任务 UI 就是 MyTask 的一个前端**。
- **cos72 侧工作**：加社区作用域（任务归属某社区 / 用该社区 xPNTs 计奖）+ 角色菜单；后端复用 MyTask `api-server`。
- **SDK 诉求（B）**：下沉 `TaskClient` 到 `@aastar/sdk`（现无 tasks primitive），供 cos72/扩展/移动共用。

### MyShop（`~/Dev/mycelium/MyShop`）— 全栈已就绪，移植前端
- **是什么**："链上协议 + 轻服务"最小电商/门票/权益。合约 = **MyShops(店铺注册)+MyShopItems(上架+原子 `buy()`)** + APNTsSale/GTokenSale；**Worker**(Permit 签名/Query API)；**Vite 前端**(广场/aPNTs&GToken 购买/风控/买家/店主后台/协议后台)。用 aPNTs/GToken。
- **cos72 侧工作**：复用 MyShops/Items 合约 + Worker；把 Vite 前端**移植/重写进 cos72 Next 皮肤**（统一账户/gasless/社区作用域），或先 link 后融。
- **SDK 诉求**：MyShops/Items 读写 + Permit 购买封装（现 SDK tokens 子包有 aPNTs 买入，可扩到店铺）。

### MyVote（`~/Dev/mycelium/MyVote`）— Snapshot fork + AirAccount，已改
- **是什么**：**Snapshot 前端 fork，已集成 AirAccount 插件**（Web2 账户+指纹登录）；Vite。带 Snapshot 治理调研报告（皮肤/Fork/新造 决策）。这就是"snapshot 改版"。
- **cos72 侧工作**：它已是独立 app（Snapshot 栈 = Vue/Vite，与 cos72 Next 异栈）——**评估 embed（iframe/子域）vs 移植**。因异栈，MyVote 可能**保持独立 app + SSO（共用 AirAccount 登录）**，而不硬塞进 Next；用户体感上从 cos72 菜单跳过去、账户互通。
- **SDK 诉求**：投票权重读取（xPNTs 余额/SBT）+ AirAccount 登录 SSO 对齐。

> **集成策略要点**：三模块合约层已部署可复用；后端(api-server/worker)作服务复用；**前端异栈**（MyTask=Next 已并入 YAAA / MyShop=Vite 移植 / MyVote=Snapshot 保独立+SSO）。统一走 **aPNTs/GToken/xPNTs + SBT** 经济轨道（对齐 PGL），统一 AirAccount 登录。**先备份 `~/Dev/mycelium/*` 与老 Cos72 作参考基线。**

---

## 3. 分发形态（去掉多租户，重映射愿景）

### ① 配置即部署 + 部署 skill —— 面向"别的组织自建整套 cos72"
- **不是**一社区一部署（那是多租户，已否）。是**另一个组织/生态（如非 AAStar 系）fork cos72，指向自己的 KMS/RPC/bundler/合约集，部署整套到 Cloudflare**。deploy 单位 = 整个 cos72 实例（人人平等、共用一套合约）。
- **技术**：外部指针已 env 驱动（KMS_PROXY_URL/RPC/bundler/backend/`NEXT_PUBLIC_*` 地址）——直接复用；**唯一缺口 = 品牌配置层**（现硬编码于 `app/page.tsx`/`Layout.tsx`/内联 i18n → 抽进 `config/brand.ts`）。
- **产出 skill `cos72-deploy`**：交互收集品牌 + 依赖 → 生成 `.env`+`brand.ts` → cloudflared ingress + CNAME（照 [[deploy-topology-cloudflare-tunnel]] 用 zone 93c89a98 API）→ 跑 `deploy-frontend.sh --public` 验证。
- **复用本次 `deploy-frontend.sh`**（build+kickstart+chunk-200 验证），把 `PUBLIC_HOST` 参数化。

### ② 社区能力 = 角色菜单 + 链上社区对象（**不是租户**）—— 修正核心
- **重新理解愿景②**：小社区"不部署"——他们**用母站 cos72**；"建立社区" = 在 app 里**链上 `registerRole(ROLE_COMMUNITY)` + 填社区元信息**（名/描述/logo，存链上/IPFS）；"社区首页" = 该社区的**链上 metadata 被渲染**（如 `/community/<addr>` 详情页，非独立子域部署）；"普通用户进入依然是 cos72" ✅ —— 因为**就是同一个皮肤，人人平等**，只是你看到的社区数据/菜单按你账户角色变。
- **技术（简单得多，无需 middleware/多租户基建）**：
  1. **角色菜单**：登录后读账户链上角色（ROLE_COMMUNITY / EndUser / operator...）→ 渲染对应菜单（管理员见"发任务/上架/治理/成员管理"，普通用户见"浏览/加入/领任务/兑换/投票"）。这**就是现有设计方向**，只需把菜单绑到链上角色读取。
  2. **社区写侧向导**（新建，对齐 cos72-tour `community-admin.ts` COM-A-01..09）：买 GToken→stake→`registerCommunity`→`deployxPNTs`→选 gas 策略→日常运营。移植旧 Cos72 Dialog 的交互、用 @aastar/sdk 重写。
  3. **社区详情/首页路由**：`/community/<addr>` 渲染链上 metadata + 该社区的任务/商品/投票（都按社区 filter）。
- **无需**：middleware、host→tenant、runtime per-host 配置、每社区独立部署——全删。

### ③ create-cos72-dapp 重建 —— 生成一张"皮肤"
- 旧的是 ~80 行空壳（指向不存在的 `cos72-team/template-*`，org 名/包名/README 三处不一致）。**吸取经验重建**。
- **产品**：`npx create-cos72-dapp my-app` → 生成一个内嵌账户基础功能（注册/积分/转账/gasless）的站 = 一张最小 cos72 皮肤。
- **技术**：建 2-3 个真模版仓（`AAStarCommunity/template-react`/`template-next`），预装 `@aastar/sdk@0.41.0`+`viem`，接**托管 RP/bundler/paymaster**（见横切认证边界），开箱有 passkey 注册/余额/积分/gasless；CLI 加 env 注入（社区元信息/KMS url/RPC/地址）。
- **依赖 ④**：模版质量取决于 SDK 是否有好用组件——所以 ④ 先于 ③。

### ④ 可嵌入（独立网站接入）—— **SDK 出底层组件，cos72 做集成（B）**
- **现状实测（`@aastar/sdk@0.41.0`）**：browser-bundler-safe、非 Next 耦合、React optional；子入口 airaccount/enduser/tokens/community 可第三方 import。**但：无 UMD/IIFE（不能裸 `<script>`/CDN）、无 React 组件库（只 2 hook）、无 tasks primitive**。
- **分工（B）**：
  - **SDK 侧（cos72 提诉求，SDK 交付底层组件）**：(a) 加 `iife`/UMD 构建 → `window.AAStar`，让非打包站能 `<script>` 引；(b) headless building blocks + 极薄 React hooks（`useAccount`/`useBalance`/`usePoints`/`useTasks`）；(c) 下沉 `TaskClient`。
  - **cos72 侧（集成方案）**：把 SDK 组件**组装成可嵌入形态**——`<script>` 一行 `AAStar.mount('#el',{features})` 的浮窗（移植旧 Cos72 `Embed.tsx` 模式）、React 组件包 `@cos72/embed`（RegisterButton/BalanceCard/PointsBadge/TaskList）、独立站接入文档。
- **认证边界（决定"无后端 drop-in"是否成立）**：passkey WebAuthn ceremony 由 **`kms.aastar.io`** 承接（浏览器**直做 ceremony、无需 api-key**）；KMS `x-api-key` / agent-key Bearer JWT 只在服务端；gasless 需 bundler+paymaster。→ **KMS/DVT 走 SDK 默认（生态锁定）；bundler/RPC 用户可自配或用母站（用母站需 KMS api-key）**。这是 ④⑤ 纯客户端接入的前提（KMS key 永不进前端）。

### ⑤ Chrome 扩展 —— 同一皮肤的第二前端（Brood TASK-6）
- **已立项**（task-13 依赖 TASK-6）。技术可行性高：SDK 纯 ESM/viem、无 Node/Next 耦合；passkey 走托管 RP；KMS key/EOA 留服务端。**唯一小心点**：扩展 origin 下的 WebAuthn rpId/origin。
- **定位**：跨站的第二皮肤——管理员：创建/管理社区、发布任务；普通用户：浏览/加入/领任务/兑换/投票。
- **注意**：社区"创建/管理/发任务"这些**管理能力目前不在 YAAA，愿景明说"后续独立加"** → 先在 cos72（②的写侧向导）做出来，扩展复用同一 SDK。**扩展晚于 cos72 Web**。

### 移动 + FangPay —— 又两张皮肤
- 移动版：RN/Capacitor 复用同一 SDK；passkey→平台生物识别 + 托管 RP。
- FangPay：支付形态，接 SDK 的 `x402`/`channel` 子包 + SuperPaymaster gasless。都是同一 SDK+合约的皮肤。

---

## 4. 横切关注点（皮肤层带来的简化）

- **合约是真相源**：无 app 侧租户状态/DB 分区；社区/任务/积分/成员/投票都读链上。这让所有皮肤天然一致、无同步问题——**这是"皮肤层"最大的架构红利**。
- **纯前端化是 ④⑤ 的隐性前置**：cos72 fork 若要真正"drop 进任意站/扩展/移动"，写侧需从 YAAA 后端(:3000)迁进 SDK（现 auth/account/transfer 仍需后端；tasks/lib/sdk 已纯客户端）——正是 [[pure-frontend-migration]] 在做。皮肤越轻，越易多端复用。
- **多链**：现 Sepolia-only 硬编码（`lib/sdk/client.ts` 只 import sepolia/anvil）；随 CC-30 主网门（G1 主网 V5 部署 + G5 DVT 主网节点）解绑。
- **registry 废弃（D）**：不作为资产；其 SuperPaymaster 运营面设计已并入 YAAA（operator/governance 页）。
- **积分/声誉统一**：xPNTs（社区实例，USD 锚）/ OpenPNTs（协议）+ SBT，对齐 PGL 分账（Supplier50-90/Wrapper0-40/Seller10）。

---

## 5. 路线图（修正版）

| Phase | 交付 | 复用 vs 新建 | 解锁 |
|---|---|---|---|
| **0（now）** | ① 品牌配置层 + `cos72-deploy` skill + 参数化 `deploy-frontend.sh` | 外部依赖复用，品牌层新建 | 别的组织自建 cos72 |
| **1** | **cos72 = fork YAAA** 立仓 + 角色菜单（读链上角色渲染菜单）+ 社区详情路由 | fork YAAA，菜单绑角色 | ② 社区可见性（人人平等皮肤）|
| **2** | **MyTask 集成**（社区作用域 + 复用 MyTask 合约/api-server，YAAA 已有前端）+ SDK `TaskClient` 下沉 | 大量复用（YAAA=MyTask 前端）| 三模块之一 |
| **3** | **社区写侧向导**（registerCommunity→deployxPNTs→gas 策略，移植旧 Cos72 Dialog）+ **MyShop 集成**（复用合约+Worker，移植 Vite 前端进 cos72 皮肤）| 向导新建；MyShop 移植 | 社区创建/管理 + 兑换 |
| **4** | ④ SDK 底层组件（UMD + hooks + TaskClient）+ cos72 集成（`<script>` widget / `@cos72/embed`）+ **托管 RP/bundler/paymaster 端点定稿** | SDK 出件、cos72 集成 | 嵌入任意站；喂养 ③⑤ |
| **5** | **MyVote 集成**（Snapshot fork 已改+AirAccount，评估 embed+SSO vs 移植）+ **create-cos72-dapp 重建**（模版仓 + env 注入）| MyVote 复用 fork；模版摆 ①③④ 成果 | 三模块齐 + create-app |
| **6** | Chrome 扩展（Brood TASK-6，复用 SDK + ③的管理能力）| 复用全部 | 第二前端 |
| **7** | 移动 + FangPay（RN/Capacitor + x402/channel 皮肤）| 复用全部 SDK | 终点 |

**顺序逻辑**：先立 fork + 角色菜单（P1）让"皮肤 + 平等 + 链上社区"成型；MyTask 复用度最高先做（P2）；社区写侧 + MyShop（P3）；SDK 组件层（P4）是 ③⑤移动 的公共杠杆；MyVote + create-app（P5）；扩展/移动/FangPay 都是"同一 SDK 的又一皮肤"，最后。

---

## 6. 立即可做（本周）

1. **P0-a（零风险重构）**：抽 `app/page.tsx`+`Layout.tsx` 品牌/文案进 `config/brand.ts`（默认=现 cos72）。这是"皮肤可换"的地基，也是 ① 部署 skill 的前提。
2. **P0-b**：参数化 `deploy-frontend.sh` 的 `PUBLIC_HOST` + 写 `cos72-deploy` skill 骨架。
3. **P1 预研**：确认 **cos72 fork 仓的建立方式**（是 fork `YetAnotherAA` 建 `Cos72` 新仓，还是在 YAAA 内开 `cos72/` 应用目录？——影响 rebase 策略）。
4. **给 SDK 提第一批诉求（B）**：`TaskClient` 下沉 + `iife`/UMD 构建 + 极薄 hooks —— 在协同中枢开任务 @repo:sdk。
5. **CC-33 credibility 页**：依赖已解齐（SDK 0.41.0），是 YAAA/cos72 侧现成能落地的实质开发，可作为 MyShop/社区页的"信任展示"前身。

**待你拍板**：
- (a) cos72 fork 的形态：**独立 fork 仓** vs **YAAA 内子应用**？
- (b) 托管 **RP/bundler/paymaster 公共端点**由母站统一提供（这决定 ④⑤移动 的"无后端接入"是否成立）？
- (c) 三模块顺序：MyTask→MyShop→MyVote（本文假设），还是别的？

---

## 附：修正后的资产映射

| 愿景要素 | 已有 | 缺口/新建 |
|---|---|---|
| 账户/passkey/gasless/tier | YAAA（fork 基座）| — |
| MyTask | **`~/Dev/mycelium/MyTask` 全栈**（TaskEscrow/Jury/SBT+api-server，YAAA 已是其前端，x402）| 社区作用域 + SDK `TaskClient` 下沉 |
| MyShop | **`~/Dev/mycelium/MyShop` 全栈**（MyShops/Items 合约+Worker+Vite 前端，用 aPNTs/GToken）| 移植前端进 cos72 皮肤 |
| MyVote | **`~/Dev/mycelium/MyVote`**（Snapshot fork + AirAccount 已集成，Vite）| embed+SSO vs 移植（异栈）|
| 社区链上原语 | **SuperPaymaster v5**（role/community/SBT/xPNTs）| — |
| 社区写侧流程 | cos72-tour `community-admin.ts` 规格（COM-A）| 向导新建（移植旧 Cos72 Dialog）|
| 角色菜单/皮肤 | 现有单站设计方向 | 菜单绑链上角色 + 品牌配置层 |
| 积分买入 | YAAA `/tokens`（xPNTs）| — |
| SDK 底层 | `@aastar/sdk@0.41.0`（headless）| UMD + React hooks + TaskClient（cos72 提诉求）|
| create-app | `create-cos72-dapp`（空壳）| 重建 |
| Chrome 扩展 | Brood TASK-6（立项）| 建（第二前端 + 管理能力）|
| registry | ~~SuperPaymaster portal~~ | **废弃（D，已并入 YAAA）**|
| 协议对齐 | PGL/AgentStore/xPNTs/OpenPNTs | 后接 |
