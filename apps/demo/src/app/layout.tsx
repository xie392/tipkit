import type { Metadata } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_KEYWORDS } from "@/lib/site";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TipKit —— 无头 Tiptap 编辑器",
    template: "%s | TipKit",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: "TipKit —— 无头 Tiptap 编辑器",
    description: SITE_DESCRIPTION,
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: "TipKit —— 无头 Tiptap 编辑器",
    description: SITE_DESCRIPTION,
    images: ["/icon.svg"],
  },
};

/* 手绘主题（sketch.css）所需字体：Caveat 标题 + Patrick_Hand 正文
 * 由消费方引入（主题包不打包字体文件），通过 CSS 变量注入 sketch.css */
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-hand-display",
  weight: ["500", "600", "700"],
});

const patrick = Patrick_Hand({
  subsets: ["latin"],
  variable: "--font-hand-body",
  weight: "400",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${caveat.variable} ${patrick.variable}`} suppressHydrationWarning>
      <head />
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
