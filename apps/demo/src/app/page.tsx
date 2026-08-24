"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useDemoLang } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";
import {
  Blocks,
  FileCode2,
  Layers,
  Palette,
  Plug,
  Slash,
  type LucideIcon,
} from "lucide-react";

const FEATURE_ICONS: LucideIcon[] = [Layers, Palette, Plug, FileCode2, Slash, Blocks];

const STEP_CODES = [
  `pnpm add @tipkit/editor @tipkit/extensions @tipkit/ui @tipkit/components @tipkit/themes`,
  `import { TipKitEditor } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import "@tipkit/themes/default.css";

export default function App() {
  return <TipKitEditor extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]} />;
}`,
  `{comment}
import "@tipkit/themes/sketch.css";

<div className="tk-theme-sketch">
  <TipKitEditor extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]} />
</div>`,
];

export default function Home() {
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].home;

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
            {c.heroTitleA}
            <br />
            <em>{c.heroTitleB}</em>
          </h1>
          <p className="site-hero-desc tk-reveal" style={{ animationDelay: "0.12s" }}>
            {c.heroDesc}
          </p>
          <div className="site-hero-cta tk-reveal" style={{ animationDelay: "0.18s" }}>
            <Link href="/docs" className="site-btn site-btn-primary">
              {c.heroCtaPrimary}
            </Link>
            <Link href="/demo" className="site-btn site-btn-ghost">
              {c.heroCtaGhost}
            </Link>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* 特性 */}
      <section className="site-section">
        <div className="site-section-inner">
          <h2 className="site-section-title">{c.featuresTitle}</h2>
          <p className="site-section-desc">{c.featuresDesc}</p>
          <div className="site-feature-grid">
            {c.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Layers;
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
          {[...c.abilities, ...c.abilities].map((ability, i) => (
            <span key={i} className="site-marquee-item">
              {ability}
            </span>
          ))}
        </div>
      </section>

      {/* 三步接入 */}
      <section className="site-section site-section-alt">
        <div className="site-section-inner">
          <h2 className="site-section-title">{c.stepsTitle}</h2>
          <p className="site-section-desc">{c.stepsDesc}</p>
          <div className="site-steps">
            {c.steps.map((s, i) => (
              <div key={s.title} className="site-step tk-reveal" style={{ animationDelay: `${0.06 * i}s` }}>
                <div className="site-step-head">
                  <span className="site-step-index">{i + 1}</span>
                  <h3>{s.title}</h3>
                </div>
                <p className="site-step-desc">{s.desc}</p>
                <pre className="site-code">
                  <code>{STEP_CODES[i].replace("{comment}", c.stepsCodeComments.sketch)}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="site-cta-band">
        <div className="site-cta-inner">
          <h2>{c.ctaTitle}</h2>
          <p>{c.ctaDesc}</p>
          <div className="site-hero-cta">
            <Link href="/docs" className="site-btn site-btn-primary">
              {c.ctaPrimary}
            </Link>
            <Link href="/demo" className="site-btn site-btn-ghost">
              {c.ctaGhost}
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
  const { lang } = useDemoLang();
  const p = SITE_COPY[lang].home.preview;

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
              <h1>{p.h1}</h1>
              <p>
                {p.p.pre}
                <strong>{p.p.bold}</strong>
                {p.p.mid}
                <em>{p.p.italic}</em>
                {p.p.post}
              </p>
              <blockquote>
                <p>{p.quote}</p>
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
              <h1>{p.h1}</h1>
              <p>
                {p.p.pre}
                <strong>{p.p.bold}</strong>
                {p.p.mid}
                <em>{p.p.italic}</em>
                {p.p.post}
              </p>
              <blockquote>
                <p>{p.quote}</p>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
      <div className="site-preview-caption">{p.caption}</div>
    </div>
  );
}
