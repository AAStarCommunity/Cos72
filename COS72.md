# Cos72

**Cos72 = YetAnotherAA 的 fork = 链上合约的「皮肤层」**（经 `@aastar/sdk` 封装）。
无多租户、人人平等；登录后**按账户的链上角色**（SP-v5 role / community）看到不同菜单。
社区 / 任务 / 积分 / 兑换 / 投票 都是**链上对象**，Cos72 只渲染。依赖 AirAccount(KMS) + DVT infra。

## 与 YetAnotherAA 的关系
- `upstream` remote = `AAStarCommunity/YetAnotherAA`（基座）。
- 同步基座更新：`git fetch upstream && git merge upstream/master`。
- **基础 portal（注册社区 / 注册 SuperPaymaster / stake / 治理）留在 YAAA 维护**，Cos72 rebase 继承、不在此改；Cos72 只做入口聚合 + 角色菜单。

## 目录结构
```
aastar-frontend/ aastar/   # 继承 YAAA 基座（账户/gasless/基础 portal），rebase 更新
config/brand.ts            # 品牌配置层（换皮），默认 = Cos72
modules/                   # 三大核心模块（集成 ~/Dev/mycelium/*）
├── mytask/  myshop/  myvote/
apps/                      # 四种分发场景（同一套 SDK+合约的不同皮肤）
├── extension/  mobile/  embed/  create-app/
```

## 集成三模块的硬要求
① 界面风格一致　② 保障 AirAccount 登录打通。

> 详细演进评估见 YetAnotherAA `docs/COS72_PLATFORM_EVOLUTION.md`。
