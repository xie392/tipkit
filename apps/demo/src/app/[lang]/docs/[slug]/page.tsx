import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPageView, docStaticParams, docMetadata } from "@/components/docs/doc-page-view";

const LANGS = ["zh", "en"] as const;

export function generateStaticParams() {
  return docStaticParams().flatMap(({ slug }) =>
    LANGS.map((lang) => ({ lang, slug })),
  );
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug, lang }) => {
    if (lang !== "zh" && lang !== "en") return {};
    return docMetadata(slug, lang);
  });
}

/** 带语言前缀的文档路由：/zh/docs/{slug} 与 /en/docs/{slug}（默认中文见 /docs/{slug}） */
export default async function LangDocPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { slug, lang } = await params;
  if (lang !== "zh" && lang !== "en") notFound();
  return <DocPageView slug={slug} lang={lang} />;
}
