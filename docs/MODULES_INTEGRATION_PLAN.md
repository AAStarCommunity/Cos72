# Cos72 × 三模块集成 — 系统 TODO 总表

> 记录时间:2026-07-14。来源:cos72 / MyTask / MyShop / MyVote /
> YAAA 五仓全量调研(三模块由并行深查得出)。配套:`docs/HANDOFF.md`(会话交接)、`docs/PHASE0_SHARED_LAYER.md`(共享层蓝图)、`docs/MODULES_VS_INFRA_OVERLAP.md`(重复/冲突清单)。本文是**执行看板**:任务编号稳定,完成打 ✅,跨仓任务用 goutou(Seeder)派发时引用编号。

---

## 0. 锁定决策(执行基线,不再讨论)

1. **合约留原仓**:MyTask /
   MyShop 的合约在各自仓库改造与部署;MyVote 无合约(Snapshot 链下投票)。
2. **cos72 重写前端皮层**:模块 UI 全部在 cos72 内以 YAA
   Layout + 设计系统重建,不搬原前端代码,只移植业务语义。
3. **用户层 = AirAccount-only**(cosSend gasless
   UserOp,无 window.ethereum);infra/operator 层 = EOA。
4. **技术栈统一 viem**,弃 ethers(上游 YAAA 8 文件迁移 = CC-43 已派)。
5. **链 = Sepolia**;KMS/DVT 用 SDK 默认;bundler/RPC 用户自配或母站。
6. 生态资产复用:生态 canonical SBT / SuperPaymaster ERC-8004 注册表 /
   DVT 质押惩罚 / xPNTsFactory 发 xPNTs / KMS
   agent-key 签名(禁明文私钥)/ 治理多签。
7. MyVote:独立部署 + AirAccount SSO 跳转(不打包进 cos72)。

**SDK
0.42 已就绪的生态接口**(模块改造 = 删自造接 SDK,无需等上游):`xPNTsFactory/Token`(含
`autoApprovedSpenders`/`addAutoApprovedSpender`)、`MySBT/SBTActions`、SuperPaymaster 信用(`getCreditLimit`/`recordDebtWithOpHash`)、`x402 FacilitatorClient`、`TokenSaleClient`。

---

## 1. 任务编号规则

| 前缀   | 归属仓                | 说明                           |
| ------ | --------------------- | ------------------------------ |
| `A-*`  | cos72                 | 基础链条(与具体模块无关的底盘) |
| `MT-*` | MyTask / cos72        | B 线,注明改在哪个仓            |
| `MS-*` | MyShop / cos72        | C 线,注明改在哪个仓            |
| `MV-*` | MyVote / cos72 / KMS  | D 线,注明改在哪个仓            |
| `E-*`  | SP / DVT / KMS / YAAA | 生态依赖线(goutou 派发)        |

优先级:**P0 = 阻塞集成/存在资金或卡死风险;P1 = 上线前必须;P2
= 加固与体验,可后置。**

---

## 2. A 线 — cos72 本体基础链条

| #   | 任务                                                                                                                                                                                                   | 优先级 | 状态               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------ |
| A-1 | Phase 0 共享层(cosSend 全 tier + 三层导航 + 角色门控 + addresses)PR#1-5                                                                                                                                | P0     | ✅                 |
| A-2 | Phase 1 MyTask `app/tasks` 全流程 cosSend 化,PR#8                                                                                                                                                      | P0     | ✅                 |
| A-3 | CI 基线清债:prettier 14 文件 + `eslint-plugin-react-hooks` 钉 7.0.1 对齐上游(PR#10,**14/14 checks 全绿**)                                                                                              | P0     | 🟡 待 review/merge |
| A-4 | 仓库开启 GitHub **Dependency Graph**(Security Audit 唯一堵点;fork 默认关)— 已经 `gh api` 启用,SBOM 1322 包,PR#10 Security Audit 转绿                                                                   | P0     | ✅ 2026-07-14      |
| A-5 | `CLAUDE.md` 入仓(/init 已生成,在 stash)                                                                                                                                                                | P2     | ⬜                 |
| A-6 | 例行 `git merge upstream/master`(节奏:上游每合大 PR 后;重点等 CC-43 viem 迁移落地)                                                                                                                     | P1     | ⬜ 循环任务        |
| A-7 | 运行时配置页(RPC/bundler 用户自配,`config/brand.ts` 无硬默认的补全 UI)                                                                                                                                 | P1     | ⬜                 |
| A-8 | **共享 indexer 基建**:NestJS 事件索引模块(replay lookback + txHash:logIndex 去重 + reorg 回滚 + DB 持久化,语义照抄 **MyShop 仓** `worker/src/apiServer.js`)。MyTask 列表扩展性与 MyShop purchases 共用 | P1     | ⬜                 |
| A-9 | e2e 基线扩展:登录→transfer→task 建单的 Playwright 冒烟,进 CI                                                                                                                                           | P2     | ⬜                 |

---

## 3. B 线 — MyTask(离完成最近:前端已好,剩合约收尾)

### 3.1 MyTask 仓(合约)

| #    | 任务                                                                                                                                                                                                                                                                          | 优先级 | 说明                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------- |
| MT-1 | **Jury 分成资金黑洞修复**:escrow 把 10% jury share 转给 JuryContract 后永久锁死(合约无任何转出函数)。改 pull 模式:按 task 给投票 juror 记账 `pendingRewards[juror][token]`,juror `claimRewards` 自取;dust 归 owner sweep                                                      | **P0** | ✅ PR MushroomDAO/MyTask#9 |
| MT-2 | **challengeWork 兼容 AA**:现要求原生 ETH `msg.value≥0.01` 质押(gasless 用户无 ETH),退款用 `transfer()`(2300 gas,AA 合约账户必 revert → 任务永久卡死)。改 ERC-20(xPNTs)质押 `transferFrom` + 退款走 ERC-20 transfer                                                            | **P0** | ✅ PR MushroomDAO/MyTask#9 |
| MT-3 | `DeploySepolia.s.sol` + broadcast 记录提交 git(当前部署不可复现)                                                                                                                                                                                                              | **P0** | ✅ PR MushroomDAO/MyTask#9 |
| MT-4 | 生态 SBT 替换:重部署时 `MYSBT_ADDRESS` 指向 canonical `0x4867…5Aa7`(脚本入口已留;JuryContract 侧 try/catch 天然兼容)                                                                                                                                                          | P1     | ⬜                         |
| MT-5 | 奖励 token 换真 xPNTs + 该 token `addAutoApprovedSpender(taskEscrow)`(需 communityOwner/FACTORY 权限)→ createTask 1 op;删 `createTaskWithPermit`/`acceptTaskWithSignature`(ecrecover,AA 永远不可用);修 `assignSupplier` 误用 `ZeroAmount()` error;`Disputed` 枚举补入口或删除 | P1     | ⬜                         |
| MT-6 | ERC-8004 对接 SuperPaymaster canonical 注册表(现为 JuryContract 内嵌平行实现,拆接口/做适配层)                                                                                                                                                                                 | P1     | ⬜ 依赖 E-1 线沟通         |
| MT-7 | Jury 质押从 mock xPNT 迁 DVT 复用 + slashing 实装(现只有 `slashed:false` 死字段)                                                                                                                                                                                              | P1     | ⬜ 依赖 E-2                |
| MT-8 | 重部署 Sepolia(MT-1..5 完成后)+ 新地址交付 cos72                                                                                                                                                                                                                              | P1     | ⬜                         |
| MT-9 | 工程加固:forge test CI workflow(现无);SafeERC20 化;api-server receipt 持久化(现内存 Map);Jury sybil 抵抗(开角色门控 + 非零 minStake)                                                                                                                                          | P2     | ⬜                         |

### 3.2 cos72 仓(MyTask 前端补全)

| #     | 任务                                                                                                                                  | 优先级 | 说明        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| MT-10 | 切 MT-8 新地址;删 approve 流(mock USDC 2 op → xPNTs 1 op)                                                                             | P1     | ⬜          |
| MT-11 | challenge/仲裁 UI:challengeWork、jury 注册/投票/finalize、linkJuryValidation、validation requirement 展示(现只覆盖 happy path 8 函数) | P1     | ⬜          |
| MT-12 | x402 付费发帖(AA-x402 direct 路径):KMS SignHash→ERC-1271→X402Client                                                                   | P2     | ⬜ 依赖 E-3 |
| MT-13 | credit purchase 前端(xPNTs 信用透支)                                                                                                  | P2     | ⬜ 依赖 E-1 |

---

## 4. C 线 — MyShop(最大工作量:合约改造 + 首次部署 + 前端整体重建)

### 4.1 MyShop 仓(合约)

| #    | 任务                                                                                                                                                                                               | 优先级 | 说明                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| MS-1 | **停自铸**(已拍板):`APNTsSale.sol:191` / `GTokenSale.sol:194` 的 `IERC20Mintable.mint` 废弃 → xPNTsFactory 发 xPNTs;`MintERC20Action` 改受控发放;**MockERC20Mintable(mint 无权限)严禁上 Sepolia**  | **P0** | 🟡 设计稿 PR MyShop#4 |
| MS-2 | **Sepolia 首次部署**(deployments 现为空串,从未上链):MockRegistry→真实 Registry、MockCommunityNFT→真实 CommunityNFT(reference/ 有 Factory 参考);写 env 驱动 DeploySepolia 脚本(禁 anvil 硬编码 key) | **P0** | ⬜                    |
| MS-3 | 治理(已拍板):4 合约单 owner EOA → Safe 多签 + Ownable2Step;riskSigner/serialSigner 更换权限收紧                                                                                                    | P1     | ⬜                    |
| MS-4 | 合约加固:`_recover` 补 EIP-2 s-value 低半序检查(或换 OZ ECDSA);Item struct 加库存 maxSupply/每地址限购/销售时间窗(链上现在没有);`buy()` 循环 mint 加 quantity cap                                  | P1     | ⬜                    |
| MS-5 | 信用购物合约侧:`MyShopItems.purchaseWithCredit`(先余额后信用),按 **MyShop 仓** `docs/CreditPayment.md` 方案对接 SP `chargeCreditForShop`                                                           | P1     | ⬜ 依赖 E-1           |

### 4.2 cos72 仓(服务 + 前端重建)

| #     | 任务                                                                                                                                                                                                  | 优先级 | 说明                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| MS-6  | **permit 签名服务并入 NestJS + KMS agent-key**(已拍板):替代 permitServer.js 明文 env 私钥;**MyShop 仓** `docs/worker.md` §B5 直接作需求文档;保留 IP 限流语义                                          | **P0** | ⬜                    |
| MS-7  | **shop 前端重建**:App Router + YAA Layout + cosSend(原 4015 行无框架 JS 零搬迁)。移植语义资产:buy 步进状态机、错误→可操作提示映射表、店内 4 级角色 gating 矩阵、purchases 凭证展示                    | **P0** | ⬜ 依赖 MS-1/2 出地址 |
| MS-8  | indexer 移植(= A-8 落地第一个消费方):Purchased 事件索引 + /shops /items /purchases /categories 查询 API                                                                                               | P1     | ⬜                    |
| MS-9  | 信用购物前端 + 统一账单展示                                                                                                                                                                           | P1     | ⬜ 依赖 MS-5          |
| MS-10 | 体验与工程:Sale 页真实化(SDK `TokenSaleClient`,替代现静态占位页);watchPurchased 通知(Webhook/TG)按需移植;ItemPage(contentHash+IPFS 版本化)+ categories 体系移植;17 个 Playwright 场景翻译成 cos72 e2e | P2     | ⬜                    |

---

## 5. D 线 — MyVote(最薄,但有一票否决风险项)

> **架构纠偏**(调研结论):MyVote 是 Vue 3 的 **Snapshot
> Classic 链下投票皮肤**,零合约、零链上交易。投票 = EIP-712 签名 POST
> hub.snapshot.org。因此「gasless UserOp」在此的正确形态 =
> **AirAccount 远程 typed-data 签名(KMS/passkey)+
> Hub 走 ERC-1271 验合约账户签名**。真正 UserOp 只在未来 Snapshot X 迁移后出现。

| #    | 任务                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 优先级        | 说明      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------- |
| MV-0 | **spike:EIP-1271 × Snapshot Hub 验签可行性** — **结论 GO(有条件)**,2026-07-14:① sequencer 对所有消息类型走 `utils.verify` 三段式(EIP-712 ECDSA → EIP-1271 `0x1626ba7e` → 旧版 1271),**且支持 ERC-6492**(Ambire deployless validator);② 验签在 **space.network** 上执行(brovider `rpc.snapshot.org/11155111` 实测通 Sepolia);③ **Sepolia space 只能建在 testnet hub**(mainnet hub 禁 testnet 网络)—— MV-5 必须用 `testnet.hub.snapshot.org`;④ AirAccount V7 `isValidSignature` 为 Safe 同款 raw-digest ECDSA(recover==owner),**passkey 断言不能直接过**——签名必须由 KMS 托管 owner key 裸签 EIP-712 digest(passkey ceremony 做授权门);⑤ envelope 硬约束 domain `snapshot/0.1.4` + types 白名单 + timestamp 窗口;⑥ 备选:**alias 机制**(主账户 1271 签一次授权,EOA alias 代签 30 天)可大幅减少 1271 调用,MV-1 设计时评估 | **P0·最先做** | ✅ GO     |
| MV-1 | [KMS+cos72] 远程 `signTypedData` API(**限定 snapshot hub domain 白名单**)+ SSO token 签发/校验端点 + CORS 白名单 MyVote 域名。设计输入(MV-0):签名 = KMS owner-key 裸签 digest(KMS 已有 `signHashWithWebAuthn` 同款能力);评估 alias 方案(KMS 持每用户 alias EOA,主账户 1271 授权一次)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **P0**        | ⬜ 可开工 |
| MV-2 | [MyVote 仓] `AirAccountAdapter` 实现(接口形状已对,现为 throw stub `airAccountProvider.ts:17,29,33`)+ auth session 持久化(现刷新即掉线)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **P0**        | ⬜        |
| MV-3 | [MyVote 仓] `ProposalPage.vue:96-115` submitVote 重写:现**绕过 provider 抽象直接抓 window.ethereum**;弃 snapshot.js(强绑 ethers v5),viem `signTypedData` + 手工构造 vote envelope POST Hub —— ethers v5→viem 一并解决                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **P0**        | ⬜        |
| MV-4 | [MyVote 仓] SSO 模式禁用 wallet provider(App.vue 下拉门控 + 默认 provider 按租户/SSO 参数切换)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **P0**        | ⬜        |
| MV-5 | [Snapshot 配置,非代码] **在 testnet hub**(testnet.snapshot.box,MV-0 结论③:mainnet hub 禁 Sepolia)建独立 space,network=11155111,`erc20-balance-of` strategy 指向 xPNTs/GToken;tenants.json/KV spaceId 切换;MyVote hub 端点从 hub.snapshot.org 切 testnet.hub.snapshot.org                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | P1            | ⬜        |
| MV-6 | [MyVote 仓] 建提案 UI(现在没有,只能去 snapshot.org 建 —— 治理闭环必需);`/api/register` 加鉴权 + rate limit(现在裸奔,公网前必修)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | P1            | ⬜        |
| MV-7 | [cos72 仓] 社区菜单(L2)加「治理」入口,带 SSO token 跳转                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | P1            | ⬜        |
| MV-8 | [MyVote 仓] 测试与 CI(现零测试);Snapshot X(sx.js)迁移评估(届时才有真 UserOp + SuperPaymaster gas 赞助);链上执行(SafeSnap 类,现完全没有)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | P2            | ⬜        |

---

## 6. E 线 — 生态依赖(goutou/Seeder 派发,跨仓)

| #   | 任务                                                                                                                                                                      | 目标仓    | 状态                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------ |
| E-1 | SuperPaymaster:`chargeCreditForShop` + `authorizedShops` 白名单(**MyShop 信用购物 + MyTask credit purchase 合并一条需求线**;设计输入 = MyShop 仓 `docs/CreditPayment.md`) | repo:sp   | 🟡 CC `d50b88b0` 调研已派,待升级为实现需求 |
| E-2 | DVT:Jury 质押/惩罚复用方案(proposal/jury 重构)                                                                                                                            | repo:dvt  | ⬜ 待发                                    |
| E-3 | DVT:X402Facilitator 合约 + facilitator 服务 Sepolia 部署(YAA-Validator#130)                                                                                               | repo:dvt  | 🟡 goutou `f14d3f9b` 已在问                |
| E-4 | YAAA:8 继承文件 ethers→viem(cos72 merge 继承)                                                                                                                             | repo:yaaa | 🟡 CC-43 已派未动工                        |
| E-5 | KMS:`signTypedData`(domain 白名单)+ SSO 端点(= MV-1 的 KMS 半)                                                                                                            | repo:kms  | 🟡 已派发 Seeder(2026-07-14,repo:kms)      |

---

## 7. 执行顺序与里程碑

```
M1 底盘收口(立即)
   A-3 merge(A-4 Dependency Graph 已开✅,CI 已全绿)
   MT-1/2/3 开工(无外部依赖)          ← 已启动
   MV-0 spike ✅ GO(2026-07-14,详见 D 线)

M2 MyTask 生产可用
   MT-4/5 → MT-8 重部署 → MT-10/11(cos72 切地址 + 仲裁 UI)
   (MT-6/7 视 E-1/E-2 进度,可后置不阻塞)

M3 MyShop 上线(与 M2 可并行启动)
   MS-1 → MS-2 部署;MS-6(NestJS permit)与 MS-7(前端重建)并行
   → MS-3 治理 → MS-8 indexer

M4 MyVote SSO
   MV-0 已通过✅ → E-5(已派)/MV-1 → MV-2/3/4 → MV-5 → MV-7 入口

M5 信用与微支付(依赖解锁后)
   E-1 落地 → MS-5/9 + MT-13;E-3 落地 → MT-12
```

**风险与关键判断**

- MyTask 两个 P0 是**资金安全/卡死级**,修完才能对外;其余是替换与补全。
- MyShop 的量最大但路径清晰,合约协议本身设计干净(改造而非重写)。
- MyVote 的 MV-0
  spike 决定整条 D 线形态(**已于 2026-07-14 完成,结论 GO**);其余工作量在 KMS/cos72 侧而非 MyVote 仓。
- E 线全部是「别人仓」的活,用 goutou 派发并在本表回填状态,不要在 cos72/模块仓里自造平行实现。
