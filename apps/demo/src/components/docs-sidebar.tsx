import Link from "next/link";

export interface DocSection {
  slug: string;
  label: string;
  items?: { id: string; label: string }[];
}

/** 文档侧边栏：主章节跳转独立页面，子小节锚点定位（sticky） */
export function DocsSidebar({
  sections,
  currentSlug,
}: {
  sections: DocSection[];
  currentSlug: string;
}) {
  return (
    <aside className="docs-sidebar">
      <p className="docs-sidebar-title">文档</p>
      <nav className="docs-sidebar-nav" aria-label="文档目录">
        {sections.map((section) => {
          const active = currentSlug === section.slug;
          return (
            <div key={section.slug} className="docs-sidebar-group">
              {section.items ? (
                <>
                  <Link
                    href={`/docs/${section.slug}`}
                    className="docs-sidebar-link docs-sidebar-link-main"
                    data-active={active || undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {section.label}
                  </Link>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/docs/${section.slug}#${item.id}`}
                          className="docs-sidebar-link docs-sidebar-link-sub"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Link
                  href={`/docs/${section.slug}`}
                  className="docs-sidebar-link docs-sidebar-link-main"
                  data-active={active || undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {section.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
      <div className="docs-sidebar-foot">
        <Link href="/demo" target="_blank" rel="noopener noreferrer" className="docs-sidebar-foot-link">
          在线演示 →
        </Link>
      </div>
    </aside>
  );
}
