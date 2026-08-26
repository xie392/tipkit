"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteThemeSwitch } from "@/components/site-theme-switch";
import { SiteLangSwitch } from "@/components/site-lang-switch";
import { useDemoLang, useDocsPathPrefix } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

/** 全站导航：TipKit 字标 + 首页 / 演示 / 文档（当前页高亮，文案跟随站点语言） */
export function SiteHeader() {
  const pathname = usePathname();
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].header;
  const docsPrefix = useDocsPathPrefix();
  const navLinks = [
    { href: "/", label: c.nav.home },
    { href: "/demo", label: c.nav.demo },
    { href: `${docsPrefix}/docs`, label: c.nav.docs },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <img src="/icon.svg" alt="TipKit" className="site-brand-logo" />
          <span className="site-brand-name">TipKit</span>
          <span className="site-brand-sub">{c.brandSub}</span>
        </Link>
        <nav className="site-nav" aria-label={c.navLabel}>
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="site-nav-link"
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="site-header-actions">
          <SiteThemeSwitch />
          <SiteLangSwitch />
          <Link href={`${docsPrefix}/docs`} className="site-header-cta">
            {c.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
