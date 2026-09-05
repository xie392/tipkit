import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

/* 服务端 PDF 导出示例（消费方参考实现）：
 * headless Chromium 渲染「编辑器 HTML + 主题 CSS」，page.pdf 输出矢量 PDF——
 * 文字可选中/搜索、分页由排版引擎处理，观感与阅读页一致。
 * 这是语雀/飞书等产品的通用做法；浏览器端 html2canvas 方案仅为无后端时的兜底。
 *
 * 部署说明：
 * - 本地 / 常规 Node 服务器：`puppeteer` 自带 Chromium，开箱即用。
 * - Vercel / Lambda 等 serverless：自带 Chromium 无法直接运行，需改用
 *   `puppeteer-core` + `@sparticuz/chromium`（官方推荐的 serverless 方案）：
 *   import chromium from "@sparticuz/chromium";
 *   const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args });
 */

export const runtime = "nodejs";

interface ExportPdfBody {
  /** 编辑器渲染后的完整 HTML（含主题类名包装） */
  html: string;
  /** 同源样式表文本（主题 CSS），保证服务端渲染观感一致 */
  css: string;
  /** 主题类名（挂在 <html> 上的作用域类，如 tk-theme-default） */
  themeClass?: string;
}

export async function POST(req: Request) {
  try {
    const { html, css, themeClass } = (await req.json()) as ExportPdfBody;
    if (!html) return NextResponse.json({ error: "html is required" }, { status: 400 });

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(
        `<!doctype html>
         <html class="${themeClass ?? ""}"><head><meta charset="utf-8"><style>${css ?? ""}</style>
         <style>
           /* 打印专用：主题在 html/body 上铺的"纸张"灰底是整页发灰的根源，强制白底。
              body::after 是主题的 SVG 格纹纸纹理（fixed 全屏），必须一并隐藏 */
           html, body { margin: 0; background: #ffffff !important; background-image: none !important; }
           body::after { display: none !important; content: none !important; }
           .tk-pdf-print { width: 794px; margin: 0 auto; }
           .tk-pdf-print button { display: none !important; }
           .tk-pdf-print .tk-code-block-toolbar { display: none !important; }
           /* PDF 底色纯白：去掉主题铺在编辑器容器上的整页"纸张"灰底，
              只保留块级元素自身的底色（代码块/callout/目录卡片等不受影响）。
              用 html 前缀抬高优先级，确保压过 .tk-theme-default .tk-editor */
           html .tk-pdf-print, html .tk-pdf-print .tk-editor,
           html .tk-pdf-print .ProseMirror, html .tk-pdf-print [class*='tk-editor'] {
             background: #ffffff !important;
             background-image: none !important;
             box-shadow: none !important;
             border-radius: 0 !important;
           }
           /* 入场动画在 headless 里不会执行，透明度会冻在初始帧，强制复位。
              注意不要动 transform：Mermaid 等 SVG 靠 transform 定位节点 */
           .tk-pdf-print *, .tk-pdf-print *::before, .tk-pdf-print *::after {
             animation: none !important;
             transition: none !important;
             opacity: 1 !important;
           }
           /* 分页保护：标题不与后文断开；所有 node-view 容器与
              代码块/表格/图片/目录/引用/脚注等整块不跨页 */
           .tk-pdf-print h1, .tk-pdf-print h2, .tk-pdf-print h3,
           .tk-pdf-print h4, .tk-pdf-print h5, .tk-pdf-print h6 { break-after: avoid; break-inside: avoid; }
           .tk-pdf-print .react-renderer, .tk-pdf-print [data-node-view-wrapper],
           .tk-pdf-print pre, .tk-pdf-print table, .tk-pdf-print img,
           .tk-pdf-print figure, .tk-pdf-print .tk-toc, .tk-pdf-print blockquote,
           .tk-pdf-print .tk-details-wrap, .tk-pdf-print .tk-hr-wrap,
           .tk-pdf-print .tk-footnotes, .tk-pdf-print .tk-keep { break-inside: avoid; }
         </style>
         </head>
         <body>${html}</body></html>`,
        { waitUntil: "load", timeout: 30000 },
      );
      // 等待字体加载完成，避免文本用了回退字体
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({
        format: "a4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "6mm", right: "6mm" },
      });
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="document.pdf"',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[export-pdf] failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
