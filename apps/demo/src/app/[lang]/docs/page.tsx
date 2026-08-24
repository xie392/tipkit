import { notFound } from "next/navigation";

const LANGS = ["zh", "en"] as const;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

/**
 * /[lang]/docs 默认进入「简介」章节。
 * 静态导出模式下不支持 redirect()，改用 meta refresh 完成跳转。
 */
export default async function LangDocsIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LANGS.includes(lang as (typeof LANGS)[number])) notFound();

  const intro = lang === "en" ? "Docs · Introduction" : "文档 · 简介";
  return (
    <html lang={lang === "en" ? "en" : "zh-CN"}>
      <head>
        <meta httpEquiv="refresh" content={`0;url=/${lang}/docs/intro`} />
      </head>
      <body>
        <p>
          {lang === "en" ? "Redirecting to " : "正在跳转到 "}
          <a href={`/${lang}/docs/intro`}>{intro}</a>…
        </p>
      </body>
    </html>
  );
}
