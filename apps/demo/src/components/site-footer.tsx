"use client";

import Link from "next/link";
import { useDemoLang } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

/** 全站页脚：项目定位 + 快速链接（文案跟随站点语言） */
export function SiteFooter() {
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].footer;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <img src="/icon.svg" alt="TipKit" className="site-brand-logo" />
          <span className="site-footer-name">TipKit</span>
          <p className="site-footer-desc">{c.desc}</p>
        </div>
        <nav className="site-footer-links" aria-label={c.navLabel}>
          <Link href="/demo">{c.demo}</Link>
          <Link href="/docs">{c.docs}</Link>
        </nav>
        <div className="site-footer-meta">
          <p className="site-footer-themes">{c.themes}</p>
          <p className="site-footer-copy">
            © {new Date().getFullYear()} TipKit · {c.copy}
          </p>
        </div>
      </div>
    </footer>
  );
}
