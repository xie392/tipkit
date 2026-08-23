import type { DocSection } from "@/components/docs-sidebar";

/** 文档章节：slug 对应 src/content/docs/{slug}.mdx，子项 id 对应页内锚点 */
export const DOC_SECTIONS: DocSection[] = [
  { slug: "intro", label: "简介" },
  { slug: "install", label: "安装" },
  { slug: "quickstart", label: "快速开始" },
  {
    slug: "concepts",
    label: "核心概念",
    items: [
      { id: "headless", label: "无头架构" },
      { id: "deps", label: "依赖注入 EditorDeps" },
      { id: "themes", label: "主题系统" },
    ],
  },
  {
    slug: "api",
    label: "API 参考",
    items: [
      { id: "props", label: "TipKitEditor Props" },
      { id: "deps-api", label: "EditorDeps" },
    ],
  },
  {
    slug: "advanced",
    label: "进阶",
    items: [
      { id: "extensions", label: "扩展机制" },
      { id: "ssr", label: "SSR 与 hydration" },
      { id: "commands", label: "常用命令" },
    ],
  },
];

export const DOC_SLUGS = DOC_SECTIONS.map((s) => s.slug);

/** 校验 slug 是否合法（404 兜底） */
export function isValidDocSlug(slug: string): boolean {
  return DOC_SLUGS.includes(slug);
}
