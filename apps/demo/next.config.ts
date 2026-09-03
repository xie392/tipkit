import type { NextConfig } from "next";

/**
 * workspace 包直接引用 TS 源码（package main 指向 src/index.ts），
 * 需要 transpile 才能被 Next 处理。
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@tipkit/core",
    "@tipkit/extensions",
    "@tipkit/ui",
    "@tipkit/components",
    "@tipkit/editor",
  ],
  allowedDevOrigins: ["10.195.133.147"],
};

export default nextConfig;
