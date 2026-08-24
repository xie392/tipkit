/**
 * 站点级双语文案（demo 站点 chrome + 首页营销内容）。
 * 编辑器 UI 文案走 @tipkit/core 内置词典（EditorDeps.t），
 * 此处只覆盖站点自身壳层：导航 / 页脚 / 侧边栏 / 翻页 / 首页。
 */
export const SITE_COPY = {
  zh: {
    header: {
      brandSub: "无头 Tiptap 编辑器",
      navLabel: "主导航",
      nav: { home: "首页", demo: "在线演示", docs: "文档" },
      cta: "快速接入",
    },
    footer: {
      desc: "基于 Tiptap v3 + shadcn/ui 的无头富文本编辑器套件",
      navLabel: "页脚导航",
      demo: "在线演示",
      docs: "接入文档",
      themes: "内置主题：default · sketch · dark",
      copy: "一套逻辑，任意风格",
    },
    sidebar: {
      title: "文档",
      navLabel: "文档目录",
      demoLink: "在线演示 →",
    },
    docsHead: {
      title: "接入文档",
      lead: "从零开始把 TipKit 接入你的 Next.js / React 项目。只需要安装聚合包、引入一个组件、选一个主题。",
    },
    pager: { prev: "上一节", next: "下一节" },
    themeMenu: {
      triggerLabel: "切换主题",
      menuLabel: "主题选项",
      current: "当前主题",
      items: {
        default: { label: "默认", desc: "shadcn 标准风格" },
        sketch: { label: "手绘", desc: "暖纸线稿风格" },
        dark: { label: "暗色", desc: "深色界面" },
      },
    },
    langMenu: {
      triggerLabel: "切换语言",
      current: "当前语言",
      items: {
        zh: { desc: "默认中文词典" },
        en: { desc: "Built-in English" },
      },
    },
    home: {
      heroTitleA: "一套逻辑",
      heroTitleB: "任意风格",
      heroDesc:
        "TipKit 是无头富文本编辑器套件。编辑器逻辑与视觉彻底解耦，同一份内容、同一套代码，通过主题皮肤自由变换风格。",
      heroCtaPrimary: "开始接入",
      heroCtaGhost: "在线演示",
      featuresTitle: "开箱即用，按需裁剪",
      featuresDesc: "扩展目录自包含、可整体裁剪；项目特定能力一律注入，不绑架你的工程。",
      features: [
        { title: "无头架构", desc: "逻辑与视觉彻底解耦：core 只算状态，主题只管渲染。同一套编辑器代码，换一个 CSS 就是另一种风格。" },
        { title: "主题皮肤", desc: "内置 default（shadcn 标准）与 sketch（手绘）两种皮肤，消费方复制一个 CSS 覆盖变量即可自定义。" },
        { title: "依赖注入", desc: "上传、附件、KaTeX 等项目特定能力全部通过 EditorDeps 注入，内核零外部服务依赖，天然可测试。" },
        { title: "Markdown 即时转换", desc: "直接粘贴 Markdown，或输入 #、- 、1. 即时转为对应节点，写作体验顺滑。" },
        { title: "斜杠菜单", desc: "输入 / 唤起可搜索的分组面板，21 种内容节点开箱即用，也可按需裁剪扩展。" },
        { title: "高级节点", desc: "表格、数学公式、分栏、折叠块、目录、附件、代码块高亮……覆盖常见编辑场景。" },
      ],
      abilities: [
        "斜杠菜单", "Markdown 即时转换", "主题换肤", "表格", "KaTeX 公式",
        "分栏布局", "折叠块", "页面目录", "代码块高亮", "Emoji 建议",
        "块拖拽手柄", "附件上传",
      ],
      stepsTitle: "三步接入",
      stepsDesc: "从空项目到可用的富文本编辑器，只需要三步。",
      steps: [
        { title: "安装", desc: "安装聚合包与主题，一行命令搞定。" },
        { title: "引入", desc: "一行组件，得到完整编辑器：工具栏、斜杠菜单、浮层、块手柄。" },
        { title: "换肤", desc: "主题 = 换一个 CSS。甚至可以在运行时切换，无需重载编辑器。" },
      ],
      stepsCodeComments: { sketch: "// 手绘风格，其余代码一行不改" },
      ctaTitle: "准备好了吗？",
      ctaDesc: "在演示页体验完整功能，或直接阅读接入文档。",
      ctaPrimary: "阅读文档",
      ctaGhost: "打开演示",
      preview: {
        h1: "你好，TipKit",
        p: { pre: "这是一段 ", bold: "加粗", mid: " 与 ", italic: "斜体", post: " 的正文，同一份内容，两种皮肤。" },
        quote: "一套逻辑，任意风格。",
        caption: "同一份内容 · default 与 sketch 两种皮肤",
      },
    },
  },
  en: {
    header: {
      brandSub: "Headless Tiptap editor",
      navLabel: "Main navigation",
      nav: { home: "Home", demo: "Live Demo", docs: "Docs" },
      cta: "Get Started",
    },
    footer: {
      desc: "Headless rich-text editor suite built on Tiptap v3 + shadcn/ui",
      navLabel: "Footer navigation",
      demo: "Live Demo",
      docs: "Integration Docs",
      themes: "Built-in themes: default · sketch · dark",
      copy: "One logic, any style",
    },
    sidebar: {
      title: "Docs",
      navLabel: "Table of contents",
      demoLink: "Live Demo →",
    },
    docsHead: {
      title: "Integration Guide",
      lead: "Add TipKit to your Next.js / React project from scratch — install the aggregate package, drop in one component, pick a theme.",
    },
    pager: { prev: "Previous", next: "Next" },
    themeMenu: {
      triggerLabel: "Switch theme",
      menuLabel: "Theme options",
      current: "Current theme",
      items: {
        default: { label: "Default", desc: "shadcn standard style" },
        sketch: { label: "Sketch", desc: "Warm paper line-art style" },
        dark: { label: "Dark", desc: "Dark interface" },
      },
    },
    langMenu: {
      triggerLabel: "Switch language",
      current: "Current language",
      items: {
        zh: { desc: "Built-in Chinese" },
        en: { desc: "Built-in English" },
      },
    },
    home: {
      heroTitleA: "One logic",
      heroTitleB: "Any style",
      heroDesc:
        "TipKit is a headless rich-text editor suite. Editor logic and visuals are fully decoupled — the same content and code, restyled freely through theme skins.",
      heroCtaPrimary: "Get Started",
      heroCtaGhost: "Live Demo",
      featuresTitle: "Batteries included, trim as you go",
      featuresDesc: "Extension directories are self-contained and fully removable; project-specific capabilities are always injected, never forced on you.",
      features: [
        { title: "Headless architecture", desc: "Logic and visuals fully decoupled: core computes state, themes handle rendering. Swap one CSS and the same editor code becomes a different style." },
        { title: "Theme skins", desc: "Two built-in skins — default (shadcn standard) and sketch (hand-drawn). Copy a CSS and override variables to customize." },
        { title: "Dependency injection", desc: "Uploads, attachments, KaTeX and other project-specific capabilities are injected via EditorDeps — zero external service dependencies, naturally testable." },
        { title: "Instant Markdown", desc: "Paste Markdown directly, or type #, -, 1. to convert into nodes in real time — a smooth writing experience." },
        { title: "Slash menu", desc: "Type / to summon a searchable grouped panel with 21 content nodes out of the box, trimmable on demand." },
        { title: "Advanced nodes", desc: "Tables, math formulas, columns, collapsible blocks, TOC, attachments, code highlighting… covering common editing scenarios." },
      ],
      abilities: [
        "Slash menu", "Instant Markdown", "Theme skins", "Tables", "KaTeX formulas",
        "Column layouts", "Collapsible blocks", "Page TOC", "Code highlighting", "Emoji suggestions",
        "Block drag handles", "Attachments",
      ],
      stepsTitle: "Three steps to integrate",
      stepsDesc: "From an empty project to a working rich-text editor in three steps.",
      steps: [
        { title: "Install", desc: "Install the aggregate package and a theme — one command." },
        { title: "Import", desc: "One component gives you the full editor: toolbar, slash menu, overlays, block handles." },
        { title: "Reskin", desc: "A theme is just another CSS. Switch at runtime without reloading the editor." },
      ],
      stepsCodeComments: { sketch: "// hand-drawn style — not a single other line changes" },
      ctaTitle: "Ready to start?",
      ctaDesc: "Try the full feature set in the live demo, or read the integration docs.",
      ctaPrimary: "Read the Docs",
      ctaGhost: "Open Demo",
      preview: {
        h1: "Hello, TipKit",
        p: { pre: "Body text with ", bold: "bold", mid: " and ", italic: "italic", post: " — same content, two skins." },
        quote: "One logic, any style.",
        caption: "Same content · default and sketch skins",
      },
    },
  },
} as const;

export type SiteCopy = (typeof SITE_COPY)["zh"];
