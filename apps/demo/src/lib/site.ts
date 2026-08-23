/** 站点全局配置（SEO / OG / sitemap 共用） */

/** 线上域名：部署时用环境变量覆盖 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tipkit.dev";

export const SITE_NAME = "TipKit";
export const SITE_DESCRIPTION =
  "TipKit —— 基于 Tiptap v3 + shadcn 的无头富文本编辑器套件：一套逻辑，任意风格";
export const SITE_KEYWORDS = [
  "TipKit",
  "Tiptap",
  "富文本编辑器",
  "无头编辑器",
  "React",
  "shadcn/ui",
  "Markdown",
];
