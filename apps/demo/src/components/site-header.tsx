"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteThemeSwitch } from "@/components/site-theme-switch";

const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/demo", label: "在线演示" },
  { href: "/docs", label: "文档" },
] as const;

/** 全站导航：TipKit 字标 + 首页 / 演示 / 文档（当前页高亮） */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <img src="/icon.svg" alt="TipKit" className="site-brand-logo" />
          <span className="site-brand-name">TipKit</span>
          <span className="site-brand-sub">无头 Tiptap 编辑器</span>
        </Link>
        <nav className="site-nav" aria-label="主导航">
          {NAV_LINKS.map((link) => {
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
        <SiteThemeSwitch />
        <Link href="/docs" className="site-header-cta">
          快速接入
        </Link>
      </div>
    </header>
  );
}
