import type { NextConfig } from "next";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Pin the Turbopack workspace root to the monorepo root (where node_modules /
  // the single package-lock.json live). Without this, `next dev` infers the root
  // and can warn/fail ("inferred your workspace root … may not be correct"),
  // restricting what it compiles. Must match outputFileTracingRoot.
  turbopack: {
    root: path.join(__dirname, ".."),
    // @aastar/sdk 0.42 的 /operator 子包有个 Foundry-CLI 签名路径 `await import('child_process')`
    // (node-only)，会泄进浏览器 bundle 让 `next build` 报 "Can't resolve child_process"。浏览器永远
    // 不走那条路，stub 成空模块即可。TODO(repo:sdk): SDK 侧应 node-guard 该路径，别进 browser-safe 子包。
    resolveAlias: {
      child_process: "./stubs/empty.ts",
    },
  },
  // Only use standalone output when explicitly enabled (e.g., for Docker builds)
  // Set NEXT_BUILD_STANDALONE=true when building for Docker
  // This prevents warnings when using 'npm run start' locally
  ...(process.env.NEXT_BUILD_STANDALONE === "true" && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, ".."),
  }),
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:3000";
    // /kms-api/* is handled by the server-side route handler at app/kms-api/[...path]
    // (injects the KMS key server-side + diagnostics), not by a rewrite.
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
