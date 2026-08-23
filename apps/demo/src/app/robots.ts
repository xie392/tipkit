import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 静态导出模式下需要显式声明
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
