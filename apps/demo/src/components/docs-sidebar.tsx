"use client";

import Link from "next/link";
import { useDemoLang, useDocsPathPrefix } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

export interface DocSection {
  slug: string;
  label: string;
  labelEn?: string;
  children?: DocSection[];
}

/** 文档侧边栏：主章节跳转独立页面；含 children 的章节渲染为分组（组头 + 子页面），sticky，文案跟随站点语言 */
export function DocsSidebar({
  sections,
  currentSlug,
}: {
  sections: DocSection[];
  currentSlug: string;
}) {
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].sidebar;
  const label = (zh: string, en?: string) => (lang === "en" && en ? en : zh);
  const prefix = useDocsPathPrefix();

  return (
    <aside className="docs-sidebar">
      <p className="docs-sidebar-title">{c.title}</p>
      <nav className="docs-sidebar-nav" aria-label={c.navLabel}>
        {sections.map((section) => {
          const active =
            currentSlug === section.slug ||
            (section.children ? section.children.some((child) => child.slug === currentSlug) : false);
          return (
            <div
              key={section.slug}
              className={`docs-sidebar-group${section.children ? " docs-sidebar-group--children" : ""}`}
            >
              {section.children ? (
                <>
                  <Link
                    href={`${prefix}/docs/${section.slug}`}
                    className="docs-sidebar-link docs-sidebar-link-main"
                    data-active={active || undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {label(section.label, section.labelEn)}
                  </Link>
                  <ul>
                    {section.children.map((child) => {
                      const childActive = currentSlug === child.slug;
                      return (
                        <li key={child.slug}>
                          <Link
                            href={`${prefix}/docs/${child.slug}`}
                            className="docs-sidebar-link docs-sidebar-link-sub"
                            data-active={childActive || undefined}
                            aria-current={childActive ? "page" : undefined}
                          >
                            {label(child.label, child.labelEn)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <Link
                  href={`${prefix}/docs/${section.slug}`}
                  className="docs-sidebar-link docs-sidebar-link-main"
                  data-active={active || undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {label(section.label, section.labelEn)}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
      <div className="docs-sidebar-foot">
        <Link href="/demo" className="docs-sidebar-foot-link">
          {c.demoLink}
        </Link>
      </div>
    </aside>
  );
}
