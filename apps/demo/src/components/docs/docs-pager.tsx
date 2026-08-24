"use client";

import Link from "next/link";
import { useDemoLang, useDocsPathPrefix } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

export interface DocsPagerTarget {
  slug: string;
  label: string;
  labelEn?: string;
}

/** 文档翻页：上一节 / 下一节（文案与章节名跟随站点语言） */
export function DocsPager({ prev, next }: { prev?: DocsPagerTarget; next?: DocsPagerTarget }) {
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].pager;
  const label = (t: DocsPagerTarget) => (lang === "en" && t.labelEn ? t.labelEn : t.label);
  const prefix = useDocsPathPrefix();

  return (
    <nav className="docs-pager" aria-label={c.prev + "/" + c.next}>
      {prev ? (
        <Link href={`${prefix}/docs/${prev.slug}`} className="docs-pager-link">
          <span className="docs-pager-arrow">←</span>
          <span className="docs-pager-body">
            <span className="docs-pager-label">{c.prev}</span>
            <span className="docs-pager-title">{label(prev)}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={`${prefix}/docs/${next.slug}`} className="docs-pager-link docs-pager-next">
          <span className="docs-pager-body">
            <span className="docs-pager-label">{c.next}</span>
            <span className="docs-pager-title">{label(next)}</span>
          </span>
          <span className="docs-pager-arrow">→</span>
        </Link>
      ) : null}
    </nav>
  );
}
