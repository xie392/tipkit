import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "接入文档",
};

/**
 * /docs 默认进入「简介」章节。
 * 静态导出模式下不支持 redirect()，改用 meta refresh 完成跳转。
 */
export default function DocsIndex() {
  return (
    <html lang="zh-CN">
      <head>
        <meta httpEquiv="refresh" content="0;url=/docs/intro" />
      </head>
      <body>
        <p>
          正在跳转到 <a href="/docs/intro">文档 · 简介</a>…
        </p>
      </body>
    </html>
  );
}
