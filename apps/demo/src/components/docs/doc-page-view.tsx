import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DocsSidebar } from "@/components/docs-sidebar";
import { mdxComponents } from "@/components/docs/mdx-components";
import { DocsEditorView } from "@/components/docs/docs-editor-view";
import { DocsPager } from "@/components/docs/docs-pager";
import { rehypeShiki } from "@/lib/rehype-shiki";
import { DOC_SECTIONS, DOC_SLUGS, isValidDocSlug } from "@/lib/docs-sections";
import { SITE_COPY } from "@/lib/site-i18n";

/** 由 TipKit 编辑器只读渲染的文档页（源文件为纯 Markdown），其余走 MDX 管线 */
const EDITOR_RENDERED_SLUGS = new Set(["intro", "install", "quickstart", "concepts", "api", "advanced", "i18n"]);

/** 读文档源：en 优先 {slug}.en.mdx，缺失回退中文；zh 读 {slug}.mdx */
function readDocSource(slug: string, lang: "zh" | "en"): string {
  const dir = path.join(process.cwd(), "src/content/docs");
  if (lang === "en") {
    const enPath = path.join(dir, `${slug}.en.mdx`);
    if (fs.existsSync(enPath)) return fs.readFileSync(enPath, "utf8");
  }
  return fs.readFileSync(path.join(dir, `${slug}.mdx`), "utf8");
}

/**
 * 文档页共享视图：/docs/{slug}（中文）与 /en/docs/{slug}（英文）复用。
 * 语言由路径决定（服务端渲染即正确），切换语言 = 导航到对应路径，无重挂载闪烁。
 */
export function DocPageView({ slug, lang }: { slug: string; lang: "zh" | "en" }) {
  if (!isValidDocSlug(slug)) notFound();

  const source = readDocSource(slug, lang);
  const headCopy = SITE_COPY[lang].docsHead;

  // 上一节 / 下一节（按侧边栏章节顺序）
  const index = DOC_SECTIONS.findIndex((s) => s.slug === slug);
  const prev = DOC_SECTIONS[index - 1];
  const next = DOC_SECTIONS[index + 1];

  return (
    <div className="site-shell">
      <SiteHeader />
      <div className="docs-layout">
        <DocsSidebar sections={DOC_SECTIONS} currentSlug={slug} />
        <main className="docs-content">
          {EDITOR_RENDERED_SLUGS.has(slug) ? (
            <DocsEditorView source={source} lang={lang} head={headCopy} />
          ) : (
            <MDXRemote
              source={source}
              components={mdxComponents}
              options={{ mdxOptions: { rehypePlugins: [rehypeShiki] } }}
            />
          )}

          {/* 文档翻页 */}
          <DocsPager prev={prev} next={next} />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

export function docStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export function docMetadata(slug: string, lang: "zh" | "en") {
  const section = DOC_SECTIONS.find((s) => s.slug === slug);
  const label = lang === "en" ? (section?.labelEn ?? section?.label) : section?.label;
  const title = lang === "en" ? `${label} — Docs` : `${label} —— 接入文档`;
  const prefix = lang === "en" ? `/en/docs/${slug}` : `/docs/${slug}`;
  return {
    title,
    description: lang === "en"
      ? `TipKit integration docs: ${label ?? ""}`
      : `TipKit 接入文档：${label ?? ""}`,
    alternates: { canonical: prefix },
  };
}
