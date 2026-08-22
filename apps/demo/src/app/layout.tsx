import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TipKit Demo",
  description: "TipKit —— 基于 Tiptap v3 + shadcn 的无头富文本编辑器：一套逻辑，任意风格",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
