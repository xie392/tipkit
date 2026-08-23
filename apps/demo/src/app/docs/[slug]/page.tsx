import fs from "node:fs";
import path from "node:path";
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
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
