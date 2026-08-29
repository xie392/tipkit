import type { DocSection } from "@/components/docs-sidebar";

/**
 * 文档章节：slug 对应 src/content/docs/{slug}.mdx；
 * 含 children 的章节渲染为「分组」（组头 + 子页面导航）；labelEn 供英文界面。
 * 页面内 H2/H3 内容标题的页内目录由右侧 TOC 组件负责，不再出现在侧边栏。
 */
export const DOC_SECTIONS: DocSection[] = [
  { slug: "intro", label: "简介", labelEn: "Introduction" },
  { slug: "install", label: "安装", labelEn: "Installation" },
  { slug: "quickstart", label: "快速开始", labelEn: "Quickstart" },
  { slug: "concepts", label: "核心概念", labelEn: "Core Concepts" },
  { slug: "api", label: "API 参考", labelEn: "API Reference" },
  {
    slug: "plugins",
    label: "插件 / 扩展",
    labelEn: "Plugins / Extensions",
    children: [
      { slug: "plugins-basic", label: "基础插件", labelEn: "Basic" },
      { slug: "plugins-advanced", label: "高级插件", labelEn: "Advanced" },
      { slug: "plugins-pro", label: "Pro 平替插件", labelEn: "Pro alternatives" },
      { slug: "plugins-custom", label: "自定义扩展", labelEn: "Custom extensions" },
    ],
  },
  { slug: "advanced", label: "进阶", labelEn: "Advanced" },
  { slug: "i18n", label: "多语言 i18n", labelEn: "i18n" },
];

export interface DocPage {
  slug: string;
  label: string;
  labelEn?: string;
}

/** 扁平化有序页面数组（分组子页面紧随组头之后），供翻页器 / 元数据使用 */
export const DOC_PAGES: DocPage[] = DOC_SECTIONS.flatMap((s) => [
  { slug: s.slug, label: s.label, labelEn: s.labelEn },
  ...(s.children
    ? s.children.map((c) => ({ slug: c.slug, label: c.label, labelEn: c.labelEn }))
    : []),
]);

export const DOC_SLUGS = DOC_PAGES.map((p) => p.slug);

/** 校验 slug 是否合法（404 兜底，基于扁平化后的页面 slug） */
export function isValidDocSlug(slug: string): boolean {
  return DOC_SLUGS.includes(slug);
}
