import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DocsSidebar } from "@/components/docs-sidebar";
import { mdxComponents } from "@/components/docs/mdx-components";
import { rehypeShiki } from "@/lib/rehype-shiki";
import { DOC_SECTIONS, DOC_SLUGS, isValidDocSlug } from "@/lib/docs-sections";

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const section = DOC_SECTIONS.find((s) => s.slug === slug);
    return {
      title: section ? `${section.label} —— 接入文档` : "接入文档",
      description: `TipKit 接入文档：${section?.label ?? ""}`,
      alternates: { canonical: `/docs/${slug}` },
    };
  });
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidDocSlug(slug)) notFound();

  const source = fs.readFileSync(
    path.join(process.cwd(), `src/content/docs/${slug}.mdx`),
    "utf8",
  );

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
          <div className="docs-head">
            <h1 className="docs-title">接入文档</h1>
            <p className="docs-lead">
              从零开始把 TipKit 接入你的 Next.js / React 项目。
              只需要安装聚合包、引入一个组件、选一个主题。
            </p>
          </div>
          <MDXRemote
            source={source}
            components={mdxComponents}
            options={{ mdxOptions: { rehypePlugins: [rehypeShiki] } }}
          />

          {/* 文档翻页 */}
          <nav className="docs-pager" aria-label="文档导航">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="docs-pager-link">
                <span className="docs-pager-arrow">←</span>
                <span className="docs-pager-body">
                  <span className="docs-pager-label">上一节</span>
                  <span className="docs-pager-title">{prev.label}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`} className="docs-pager-link docs-pager-next">
                <span className="docs-pager-body">
                  <span className="docs-pager-label">下一节</span>
                  <span className="docs-pager-title">{next.label}</span>
                </span>
                <span className="docs-pager-arrow">→</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
