import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { DOC_SLUGS } from "@/lib/docs-sections";

// 静态导出模式下需要显式声明
export const dynamic = "force-static";

/** 站点地图：首页 / 演示 / 文档各章节（全部静态页面） */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/demo` },
    { url: `${SITE_URL}/docs` },
    ...DOC_SLUGS.map((slug) => ({ url: `${SITE_URL}/docs/${slug}` })),
  ];
}
