import type { Metadata } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "TipKit Demo",
  description: "TipKit —— 基于 Tiptap v3 + shadcn 的无头富文本编辑器：一套逻辑，任意风格",
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
    <html lang="zh-CN" className={`${caveat.variable} ${patrick.variable}`}>
      <body>{children}</body>
    </html>
  );
}
