# Phase 0 — Cos72 共享集成层（蓝图）

> 状态：**实现蓝图，待 jason 点头即可照此编码**。三模块（Phase 1-3）都建在这层上。
> 原则：cos72 = YAAA fork = 皮肤层。Phase 0 **不写任何模块业务逻辑**，只建 5 个所有模块共用的地基原语，替换掉「裸 window.ethereum / 手填地址 / 无角色 / 无 gasless」。

---

## 架构分层（jason 2026-07-10 澄清）

```
皮肤层：Cos72（= YAAA 增强版；YAAA / Cos72 都是皮肤）
   ↓ 依赖
SDK：@aastar/sdk（需要一点配置，配置在【应用层】暴露 = self-host 的核心）
   ↓ 建在其上
合约 + Infra
   · 合约：AirAccount / SuperPaymaster / …
   · Infra（≥2，我们独有生态）：① KMS   ② DVT
        - DVT 节点下挂【可加载模块】：relay、x402 facilitator
        - keeper / relayer 等 SDK 不 care；但未来 app 可能依赖 relay
```

- **self-host 是第一目标**：SDK 的必要配置（RPC / bundler）在应用层暴露 → 用户填好自己的 RPC 即可下载 Cos72 **自运行、零外部依赖**，不必用母站。母站提供一份基础运营**兜底**（有成本 → 收 aPNTs 社区积分；**可用给社区做贡献换积分，不必花钱**；同逻辑适用其他社区）。
- **配置策略**：**KMS / DVT = 用 SDK 默认（生态锁定，用户不配）**；**bundler / RPC = 用户自配 or 用母站（用母站需 KMS api-key，server-only）**。aPNTs 支付/订阅抵扣**后续再说**。
- **auth**：无独立 `auth.aastar.io`，passkey RP / WebAuthn ceremony 已并入 **`kms.aastar.io`**。

---

## 0.0 前置

- **bump `@aastar/sdk` 0.39.4 → 0.41.0**（前端 `aastar-frontend` + 后端 `aastar`）——拿 `getCredibility`/`COMMUNITY_SAFE`/token-tier 修复。外科式改 lockfile（见 [[lockfile-surgical-bump-gotcha]] 经验）。
- **`config/brand.ts` 已建**（kms.aastar.io + RPC/bundler 运行时）。补一个**「配置页」** `app/settings/`：首启填 RPC / bundler → 存 localStorage，`brand.ts` 读取，`.env` 可覆盖。

## 0.1 统一会话（core，最先做）

**问题**：cos72 已有 passkey 登录（`app/auth/{login,register}` + `lib/kms-client.ts` + `lib/auth.ts` JWT），但模块（MyTask/MyShop）各自连 `window.ethereum` EOA，绕过它。

**建**：`contexts/Cos72SessionContext.tsx` —— 单一会话，暴露：
```ts
useCos72Session(): {
  address: Address | null        // AirAccount 智能账户地址（passkey 登录后）
  isConnected: boolean
  roles: RoleFlags               // 见 0.4
  // 写：走 gasless UserOp（0.2），不是 window.ethereum
  send: (call: ContractCall) => Promise<Hash>
  signTypedData: (td: TypedData) => Promise<Hex>   // 走 AirAccount/KMS
}
```
- 复用现有 `lib/auth.ts`（JWT）+ `lib/kms-client.ts` + `lib/tier-profiles.ts` + `lib/webauthn-rp.ts`（rpId=aastar.io）。
- **AirAccount-only，无 EOA fallback**（jason 定）：cos72 **不兼容 EOA**（passkey+email 即一切；EOA 是半成品、UX 差）。会话 = AirAccount 智能账户 + gasless，模块的 `window.ethereum` 路径是**替换**不是并存。日后若要兼容 EOA，从 AirAccount 侧加一个 EOA 兼容入口。
  - ⚠️ **开放问题（待 jason，不自作主张）**：YAAA 现有 operator / DVT-register 流程签名走 operator EOA（`WalletContext` Track C，`lib/sdk/operator.ts`）——这些也一律 AirAccount-only，还是保留一个「高级 operator EOA」轨道？

## 0.2 SDK 中介的 gasless 写路径（core）

**已建**：`lib/sdk/cosTx.ts` + `lib/api.ts` 的 `userOpAPI` ✅（本轮落地）。
```ts
cosRead({ to, abi, functionName, args }): Promise<T>            // viem public client（brand.ts RPC），已实现
cosSend(call, sign): Promise<Hash>                              // 见下，已实现前端半
```
- **架构现实（已核）**：cos72 现是**后端栈**，AirAccount 端用户交易走 NestJS 两段式（`transfer/prepare` 返 `userOpHash` → 浏览器 passkey 断言 → `transfer/submit`，后端 KMS/BLS 签+bundler）。因 **KMS 是 server-only**，gasless 写**必须经后端**，不是纯客户端构 UserOp。
- 所以 `cosSend` = 把这套 prepare/submit **从「转账专用」泛化成「任意合约调用」**：`encodeFunctionData` → `userOpAPI.prepare({to,data,value})` → `sign(userOpHash)`（passkey 断言，由 §0.1 会话提供）→ `userOpAPI.submit`。
- **待做（后端半，Phase 0 backend）**：NestJS 实现 `POST /userop/{prepare,submit,status}`（泛化现有 `transfer/*`）。前端契约已在 `userOpAPI`。
- **这是最关键的一件**：三模块所有 `walletClient.writeContract(...)` 日后全换成 `cosSend(...)`。

## 0.3 canonical 地址 + 模块地址（过渡）

**建**：`lib/addresses.ts` ——
- infra 地址从 `@aastar/sdk/core` 的 `CANONICAL_ADDRESSES` / `COMMUNITY_SAFE` / `DVT_VALIDATOR_ADDRESS` 取，**不手填**。
- 模块合约（TaskEscrowV2/JuryContract/MyShops/MyShopItems…）**SDK 还没 canonical** → 过渡期 `config/modules.ts`：vendored ABI（copy 自各源仓）+ 部署地址读 `.env`（Sepolia）。调通后再切 SDK canonical（SDK 缺口暂缓）。

## 0.4 导航模型（仿 GitHub 三层，jason 2026-07-10）

**不是简单「按角色显隐一个菜单」，是仿 GitHub 的三层导航**（user → org → repo）：

| 层 | GitHub 类比 | Cos72 | 谁提供 |
|---|---|---|---|
| **L1 用户菜单**（跨社区）| 右上角用户下拉（Profile/Repos/Organizations/Settings）| **沿用 YAAA 现有右上用户菜单** —— 用户跨社区（可属于/新建多个社区，像切 org）| **保留 YAAA，不动** |
| **L2 社区菜单**（进入某社区后横向 tab）| org 横向导航（Overview/Repositories/People…）| **横向 tab = 我们新增的模块，对所有社区通用**：MyTask / MyShop / MyVote（未来更多）+ 概览/成员/治理 | cos72 新增，**按用户在该社区的角色显隐** |
| **L3 模块子导航**（进入某模块后横向 tab）| 进入 repo 后菜单变化（Code/Issues/Actions…）| 模块自己的 sub-nav（如 MyShop：广场/我的订单/店铺后台）—— 变的是子 tab，不是全新页面壳 | 各模块内部 |

- **建**：`components/nav/{UserMenu(L1,复用), CommunityTabs(L2), ModuleSubnav(L3)}` + `lib/roles.ts` / `useRoles(communityId)`。
- **角色门控**：角色决定 L2 哪些 tab 可见（社区 owner 见治理/发币；成员见任务/商店/投票）+ L3 里哪些操作可用。读 `Registry.hasRole` + 生态 `MySBT` memberships（`sbtActions.verifyCommunityMembership`）。
- **无多租户**：用户平等，只是「当前在哪个社区上下文 + 在该社区的角色」决定看到什么（= GitHub 切 org + 你在该 org 的权限）。

## 0.5 社区 + xPNTs（模块经济地基）

**建**：`lib/community.ts` ——
- `CommunityClient.launchCommunity()`（建号即注册 ROLE_COMMUNITY + stake）、`issueXPNTs()`（发社区 xPNTs）。
- `xPNTsTokenActions().getCredibility({token})`（0.41）——可信度徽章，供商店/投票展示「是否超发/背书」。

---

## 建造顺序

`0.0 bump+配置页` → `0.1 会话` → `0.2 gasless 写路径` → `0.3 地址` → `0.5 社区/xPNTs` → `0.4 角色菜单`

## 完成标准（DoD，无模块业务）

一个 demo 页能：① passkey 登录拿到 AirAccount 地址（0.1）② 用 `cosSend` 走一次 **gasless UserOp** 写（0.2，对一个测试合约或 no-op）③ 从 SDK canonical 解析一个 infra 地址（0.3）④ 读到当前账户角色并据此显隐一个菜单项（0.4）⑤ 读一个社区 xPNTs 的 credibility（0.5）。**这五点通了 = 地基成立，Phase 1（MyTask）可以第一个接。**

---

## 与 Phase 1-3 的衔接
- **Phase 1 MyTask**：前端已是 Next（`app/tasks`），改造 = 把 `TaskContext` 的 window.ethereum → `useCos72Session().send`；合约 TaskEscrowV2/Jury/MySBT 走 `config/modules.ts`；落 MySBT 去重、ERC-8004→SP、Jury slash→DVT（见 OVERLAP §5）。
- **Phase 2 MyShop**：`app/shop` 全新写（源仓是 vanilla JS）；结账走 `cosSend` gasless + credit purchase（等 CC `d50b88b0` sp 回复）；permit 迁 KMS；停自铸 GToken/aPNTs 改 `issueXPNTs`。
- **Phase 3 MyVote**：独立部署，cos72 只加「去投票」入口 + 签发 SSO token；MyVote 侧自建 AirAccount adapter（viem）+ 投票签名重构。
