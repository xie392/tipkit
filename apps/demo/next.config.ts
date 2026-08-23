import type { NextConfig } from "next";

/**
 * workspace 包直接引用 TS 源码（package main 指向 src/index.ts），
 * 需要 transpile 才能被 Next 处理。
 *
 * output: "export" —— 纯静态导出：`next build` 生成 out/ 目录，
 * 可直接部署到任意静态托管（CDN / GitHub Pages / Nginx 等），无需 Node 服务器。
 */
const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: [
    "@tipkit/core",
    "@tipkit/extensions",
    "@tipkit/ui",
    "@tipkit/components",
    "@tipkit/editor",
  ],
};

export default nextConfig;
