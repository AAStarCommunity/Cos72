/**
 * 无需登录的 infra 初始化页（operator / EOA 层）——社区 KMS+DVT 节点 onboarding。
 *
 * 属 infra/operator 轨道（EOA，见 docs/HANDOFF §2 决策 2）：operator 用自己的注入
 * EOA 自筹（owner key 绝不进浏览器），**不需要 AirAccount 登录**。底层业务逻辑一律
 * 走 `@aastar/sdk`（onboardDvtNode / buildDvtPop / KMS popSigner），页面只串线（CC-40）。
 * 移植自 aastar-sdk `node-onboarding-portal/src/`，唯一改动 = 钱包接缝（lib/sdk.ts 已是
 * injected EOA，无需再改）。本地/HSM 私钥路径现在可跑；KMS-TEE key-less 路径 gated 在 CC-37。
 */
import Layout from "@/components/Layout";
import OnboardingWizard from "./OnboardingWizard";

export default function NodeOnboardingPage() {
  // Layout 不带 requireAuth → 无需登录即可渲染（infra 工具，非用户页）。
  return (
    <Layout>
      <OnboardingWizard />
    </Layout>
  );
}
