// Cos72 品牌 / 端点配置层（换皮的唯一入口）。
// 合约地址走 @aastar/sdk canonical（不在此填）；RPC 及各托管服务 URL 在此配置，本地 .env 可覆盖。
export const BRAND = {
  name: "Cos72",
  // 运行的托管服务默认端点（母站提供；自建者用 NEXT_PUBLIC_* 覆盖）：
  endpoints: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "", // 读链节点
    rpId: process.env.NEXT_PUBLIC_RP_ID ?? "aastar.io", // passkey RP（auth.aastar.io 托管）
    kmsApiBase: process.env.NEXT_PUBLIC_KMS_API_BASE ?? "https://kms1.aastar.io", // TEE 签名服务
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL ?? "", // ERC-4337 bundler
    // paymaster / validator 地址来自 SDK canonical，不在此配置
  },
} as const;
export type Brand = typeof BRAND;
