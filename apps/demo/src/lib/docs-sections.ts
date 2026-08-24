import type { DocSection } from "@/components/docs-sidebar";

/** 文档章节：slug 对应 src/content/docs/{slug}.mdx，子项 id 对应页内锚点；labelEn 供英文界面 */
export const DOC_SECTIONS: DocSection[] = [
  { slug: "intro", label: "简介", labelEn: "Introduction" },
  { slug: "install", label: "安装", labelEn: "Installation" },
  { slug: "quickstart", label: "快速开始", labelEn: "Quickstart" },
  {
    slug: "concepts",
    label: "核心概念",
    labelEn: "Core Concepts",
    items: [
      { id: "headless", label: "无头架构", labelEn: "Headless architecture" },
      { id: "deps", label: "依赖注入 EditorDeps", labelEn: "EditorDeps injection" },
      { id: "themes", label: "主题系统", labelEn: "Theme system" },
    ],
  },
  {
    slug: "api",
    label: "API 参考",
    labelEn: "API Reference",
    items: [
      { id: "props", label: "TipKitEditor Props", labelEn: "TipKitEditor Props" },
      { id: "deps-api", label: "EditorDeps", labelEn: "EditorDeps" },
    ],
  },
  {
    slug: "advanced",
    label: "进阶",
    labelEn: "Advanced",
    items: [
      { id: "extensions", label: "扩展机制", labelEn: "Extension mechanism" },
      { id: "ssr", label: "SSR 与 hydration", labelEn: "SSR & hydration" },
      { id: "commands", label: "常用命令", labelEn: "Common commands" },
    ],
  },
  {
    slug: "i18n",
    label: "多语言 i18n",
    labelEn: "i18n",
    items: [
      { id: "i18n-overview", label: "设计概览", labelEn: "Design overview" },
      { id: "i18n-default", label: "默认行为", labelEn: "Default behavior" },
      { id: "i18n-builtin", label: "切换内置语言", labelEn: "Switch built-in languages" },
      { id: "i18n-override", label: "覆盖部分文案", labelEn: "Override messages" },
      { id: "i18n-new-lang", label: "新增语言", labelEn: "Add a language" },
      { id: "i18n-toolbar", label: "工具栏接入", labelEn: "Toolbar integration" },
      { id: "i18n-extensions", label: "扩展使用 useT", labelEn: "useT() in extensions" },
      { id: "i18n-api", label: "API 参考", labelEn: "API reference" },
      { id: "i18n-keys", label: "词典 key 约定", labelEn: "Key conventions" },
      { id: "i18n-demo", label: "在线演示", labelEn: "Live demo" },
    ],
  },
];

export const DOC_SLUGS = DOC_SECTIONS.map((s) => s.slug);

/** 校验 slug 是否合法（404 兜底） */
export function isValidDocSlug(slug: string): boolean {
  return DOC_SLUGS.includes(slug);
}
