import type { Metadata } from "next";
import { DocPageView, docStaticParams, docMetadata } from "@/components/docs/doc-page-view";

export function generateStaticParams() {
  return docStaticParams();
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => docMetadata(slug, "zh"));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DocPageView slug={slug} lang="zh" />;
}
