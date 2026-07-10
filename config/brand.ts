// Cos72 品牌 / 端点配置层（换皮的唯一入口）。
// 合约地址走 @aastar/sdk canonical（不在此填）。
export const BRAND = {
  name: "Cos72",
  endpoints: {
    // passkey RP + TEE 签名/认证：auth 服务已统一并入 kms.aastar.io（KMS 承接 WebAuthn ceremony）
    kmsApiBase: process.env.NEXT_PUBLIC_KMS_API_BASE ?? "https://kms.aastar.io",
    rpId: process.env.NEXT_PUBLIC_RP_ID ?? "aastar.io", // WebAuthn RP，锚父域
    // RPC 读链节点：无硬默认，Cos72 启动后在「配置页」设置（.env 可覆盖）
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "",
    // ERC-4337 bundler：同样运行时「配置页」设置（.env 可覆盖），无硬默认
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL ?? "",
    // paymaster / validator 地址来自 SDK canonical
  },
  // KMS api-key 注入：
  //  · 开发/测试 → .env 覆盖（server-only，绝不进客户端 bundle）
  //  · 未来 → 用 AirAccount 登录验证「是否社区 owner」（stake 即证明基础信用），不再散发裸 key
  kmsApiKey: process.env.KMS_API_KEY ?? "",
} as const;
export type Brand = typeof BRAND;
