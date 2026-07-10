# Phase 0 — Cos72 共享集成层（蓝图）

> 状态：**实现蓝图，待 jason 点头即可照此编码**。三模块（Phase 1-3）都建在这层上。
> 原则：cos72 = YAAA fork = 皮肤层。Phase 0 **不写任何模块业务逻辑**，只建 5 个所有模块共用的地基原语，替换掉「裸 window.ethereum / 手填地址 / 无角色 / 无 gasless」。

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
- **区分两类签名主体**：终端用户操作（建任务/买货/投票）= AirAccount 智能账户 + gasless；operator 治理操作 = 现有 `WalletContext` 的 EOA（Track C，`lib/sdk/operator.ts`）——两者并存，模块业务默认走 AirAccount 会话。

## 0.2 SDK 中介的 gasless 写路径（core）

**建**：`lib/sdk/cosTx.ts` ——
```ts
cosSend({ to, abi, functionName, args, value? }): Promise<Hash>   // 构 UserOp → SuperPaymaster 赞助 → AirAccount 签 → bundler 提交
cosRead({ to, abi, functionName, args }): Promise<T>             // viem public client（brand.ts RPC）
```
- 用 `@aastar/paymaster` 的 `getSuperPaymasterMiddleware`/`checkEligibility` + `PaymasterClient.submitGaslessUserOperation`；复用 `lib/sdk/client.ts` 的 `ensureSdkConfig()`。
- **这是最关键的一件**：三模块所有 `walletClient.writeContract(...)` 调用点，日后全部换成 `cosSend(...)`。Phase 1 起逐个替换。

## 0.3 canonical 地址 + 模块地址（过渡）

**建**：`lib/addresses.ts` ——
- infra 地址从 `@aastar/sdk/core` 的 `CANONICAL_ADDRESSES` / `COMMUNITY_SAFE` / `DVT_VALIDATOR_ADDRESS` 取，**不手填**。
- 模块合约（TaskEscrowV2/JuryContract/MyShops/MyShopItems…）**SDK 还没 canonical** → 过渡期 `config/modules.ts`：vendored ABI（copy 自各源仓）+ 部署地址读 `.env`（Sepolia）。调通后再切 SDK canonical（SDK 缺口暂缓）。

## 0.4 角色 → 菜单

**建**：`lib/roles.ts` + `useRoles()` hook + `components/RoleMenu.tsx` ——
- 读 `Registry.hasRole(ROLE_COMMUNITY/…)`（`registryActions`）+ 生态 `MySBT` memberships（`sbtActions.verifyCommunityMembership`）→ `RoleFlags`。
- 菜单按 `RoleFlags` 显隐（社区 owner 看治理/发币；普通用户看任务/商店/投票入口）。

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
