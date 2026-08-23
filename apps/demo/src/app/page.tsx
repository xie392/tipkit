import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Blocks,
  FileCode2,
  Layers,
  Palette,
  Plug,
  Slash,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Layers,
    title: "无头架构",
    desc: "逻辑与视觉彻底解耦：core 只算状态，主题只管渲染。同一套编辑器代码，换一个 CSS 就是另一种风格。",
  },
  {
    icon: Palette,
    title: "主题皮肤",
    desc: "内置 default（shadcn 标准）与 sketch（手绘）两种皮肤，消费方复制一个 CSS 覆盖变量即可自定义。",
  },
  {
    icon: Plug,
    title: "依赖注入",
    desc: "上传、附件、KaTeX 等项目特定能力全部通过 EditorDeps 注入，内核零外部服务依赖，天然可测试。",
  },
  {
    icon: FileCode2,
    title: "Markdown 即时转换",
    desc: "直接粘贴 Markdown，或输入 #、- 、1. 即时转为对应节点，写作体验顺滑。",
  },
  {
    icon: Slash,
    title: "斜杠菜单",
    desc: "输入 / 唤起可搜索的分组面板，21 种内容节点开箱即用，也可按需裁剪扩展。",
  },
  {
    icon: Blocks,
    title: "高级节点",
    desc: "表格、数学公式、分栏、折叠块、目录、附件、代码块高亮……覆盖常见编辑场景。",
  },
];

/** 能力滚动条带文案 */
const ABILITIES = [
  "斜杠菜单",
  "Markdown 即时转换",
  "主题换肤",
  "表格",
  "KaTeX 公式",
  "分栏布局",
  "折叠块",
  "页面目录",
  "代码块高亮",
  "Emoji 建议",
  "块拖拽手柄",
  "附件上传",
];

const STEPS = [
  {
    title: "安装",
    desc: "安装聚合包与主题，一行命令搞定。",
    code: `pnpm add @tipkit/editor @tipkit/extensions @tipkit/ui @tipkit/components @tipkit/themes`,
  },
  {
    title: "引入",
    desc: "一行组件，得到完整编辑器：工具栏、斜杠菜单、浮层、块手柄。",
    code: `import { TipKitEditor } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import "@tipkit/themes/default.css";

export default function App() {
  return <TipKitEditor extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]} />;
}`,
  },
  {
    title: "换肤",
    desc: "主题 = 换一个 CSS。甚至可以在运行时切换，无需重载编辑器。",
    code: `// 手绘风格，其余代码一行不改
import "@tipkit/themes/sketch.css";

<div className="tk-theme-sketch">
  <TipKitEditor extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]} />
</div>`,
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />

      {/* Hero */}
      <section className="site-hero">
        <div className="site-hero-inner">
          <span className="site-badge tk-reveal">
            Tiptap v3 · React 19 · shadcn/ui
            <span className="site-badge-caret" aria-hidden="true" />
          </span>
          <h1 className="site-hero-title tk-reveal" style={{ animationDelay: "0.06s" }}>
            一套逻辑
            <br />
            <em>任意风格</em>
          </h1>
          <p className="site-hero-desc tk-reveal" style={{ animationDelay: "0.12s" }}>
            TipKit 是无头富文本编辑器套件。编辑器逻辑与视觉彻底解耦，
            同一份内容、同一套代码，通过主题皮肤自由变换风格。
          </p>
          <div className="site-hero-cta tk-reveal" style={{ animationDelay: "0.18s" }}>
            <Link href="/docs" className="site-btn site-btn-primary">
              开始接入
            </Link>
            <Link href="/demo" className="site-btn site-btn-ghost">
              在线演示
            </Link>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* 特性 */}
      <section className="site-section">
        <div className="site-section-inner">
          <h2 className="site-section-title">开箱即用，按需裁剪</h2>
          <p className="site-section-desc">
            扩展目录自包含、可整体裁剪；项目特定能力一律注入，不绑架你的工程。
          </p>
          <div className="site-feature-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="site-feature-card tk-reveal"
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <span className="site-feature-icon">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 能力滚动条带 */}
      <section className="site-marquee tk-reveal" aria-hidden="true">
        <div className="site-marquee-track">
          {[...ABILITIES, ...ABILITIES].map((ability, i) => (
            <span key={i} className="site-marquee-item">
              {ability}
            </span>
          ))}
        </div>
      </section>

      {/* 三步接入 */}
      <section className="site-section site-section-alt">
        <div className="site-section-inner">
          <h2 className="site-section-title">三步接入</h2>
          <p className="site-section-desc">从空项目到可用的富文本编辑器，只需要三步。</p>
          <div className="site-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="site-step tk-reveal" style={{ animationDelay: `${0.06 * i}s` }}>
                <div className="site-step-head">
                  <span className="site-step-index">{i + 1}</span>
                  <h3>{s.title}</h3>
                </div>
                <p className="site-step-desc">{s.desc}</p>
                <pre className="site-code">
                  <code>{s.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="site-cta-band">
        <div className="site-cta-inner">
          <h2>准备好了吗？</h2>
          <p>在演示页体验完整功能，或直接阅读接入文档。</p>
          <div className="site-hero-cta">
            <Link href="/docs" className="site-btn site-btn-primary">
              阅读文档
            </Link>
            <Link href="/demo" className="site-btn site-btn-ghost">
              打开演示
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Hero 静态预览：同一份内容，default / sketch 两种皮肤（纯展示，无交互） */
function HeroPreview() {
  return (
    <div className="site-preview tk-reveal" style={{ animationDelay: "0.24s" }}>
      <div className="tk-theme-default">
        <div className="site-preview-card">
          <div className="site-preview-toolbar">
            <span className="site-preview-dot" />
            <span className="site-preview-dot" />
            <span className="site-preview-dot" />
          </div>
          <div className="tk-editor site-preview-editor">
            <div className="tk-prosemirror">
              <h1>你好，TipKit</h1>
              <p>
                这是一段 <strong>加粗</strong> 与 <em>斜体</em> 的正文，
                同一份内容，两种皮肤。
              </p>
              <blockquote>
                <p>一套逻辑，任意风格。</p>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
      <div className="tk-theme-sketch">
        <div className="site-preview-card">
          <div className="site-preview-toolbar">
            <span className="site-preview-dot" />
            <span className="site-preview-dot" />
            <span className="site-preview-dot" />
          </div>
          <div className="tk-editor site-preview-editor">
            <div className="tk-prosemirror">
              <h1>你好，TipKit</h1>
              <p>
                这是一段 <strong>加粗</strong> 与 <em>斜体</em> 的正文，
                同一份内容，两种皮肤。
              </p>
              <blockquote>
                <p>一套逻辑，任意风格。</p>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
      <div className="site-preview-caption">同一份内容 · default 与 sketch 两种皮肤</div>
    </div>
  );
}
