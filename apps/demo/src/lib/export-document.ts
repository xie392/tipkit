import type { Editor } from "@tiptap/react";
import { createSerializer } from "@tipkit/core";

import { Packer } from "docx";
import { buildDocx, cssColorToHex } from "./html-to-docx";

/* Demo 导出助手：Markdown / Word(docx) / PDF。
 * - Markdown：createSerializer 的 toMarkdown 契约
 * - Word：docx 库 + 「编辑器 DOM → docx」转换器（读计算样式，含 lab/oklch 颜色换算）
 * - PDF：html2canvas 直接渲染编辑器真实 DOM（所见即所得）+ jsPDF 分页
 * 生产环境建议由消费方服务端（pandoc / headless Chrome）做高保真转换。
 */

const COLOR_FUNCS = /(lab|oklch|oklab|color)\([^()]*\)/g;

function toRgb(colorStr: string): string {
  const hex = cssColorToHex(colorStr);
  return hex ? `#${hex}` : "#000000";
}

/** CSS 颜色函数字符串 → RGB（保留函数外的其他内容，用于 box-shadow / gradient） */
function convertColorString(value: string): string {
  if (!COLOR_FUNCS.test(value)) return value;
  COLOR_FUNCS.lastIndex = 0;
  return value.replace(COLOR_FUNCS, (m) => toRgb(m));
}

/**
 * 在克隆树上原地把现代颜色函数（lab/oklch…）换算成 RGB。
 * html2canvas 不支持这些颜色函数，直接渲染会失败；
 * 克隆树与真实页共用样式表，计算样式一致，因此观感不变。
 * 不枚举属性，全量扫描计算样式（主题可能在 -webkit-text-stroke-color 等
 * 冷门属性上也用了 lab）；伪元素无法内联覆盖，用样式表统一兜底。
 */
function sanitizeColors(cloneRoot: Element) {
  for (const el of [cloneRoot, ...cloneRoot.querySelectorAll("*")]) {
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      const v = cs.getPropertyValue(prop);
      if (v && COLOR_FUNCS.test(v)) {
        COLOR_FUNCS.lastIndex = 0;
        try {
          (el as HTMLElement).style.setProperty(prop, convertColorString(v));
        } catch {
          /* 个别属性只读，跳过 */
        }
      }
      COLOR_FUNCS.lastIndex = 0;
    }
  }
  const style = document.createElement("style");
  style.textContent = `
    .tk-pdf-export *, .tk-pdf-export *::before, .tk-pdf-export *::after {
      border-color: #d0d7de !important;
      outline-color: #d0d7de !important;
      text-decoration-color: currentColor !important;
      caret-color: currentColor !important;
      column-rule-color: #d0d7de !important;
      -webkit-text-stroke-color: currentColor !important;
    }
    .tk-pdf-export *::before, .tk-pdf-export *::after {
      color: inherit !important;
      background-color: transparent !important;
      background-image: none !important;
      fill: currentColor !important;
    }
  `;
  cloneRoot.classList.add("tk-pdf-export");
  (cloneRoot.closest("body") ?? document.body).appendChild(style);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMarkdown(editor: Editor, filename = "document.md") {
  const serializer = createSerializer(editor);
  const md = serializer.toMarkdown(editor.getJSON());
  download(new Blob([md], { type: "text/markdown;charset=utf-8" }), filename);
}

export async function exportWord(editor: Editor, filename = "document.docx") {
  // 传入编辑器真实 DOM：转换器读取计算样式（颜色/字号/对齐），观感贴近编辑器
  const doc = await buildDocx(editor.view.dom as HTMLElement);
  const blob = await Packer.toBlob(doc);
  download(blob, filename);
}

export async function exportPdf(editor: Editor, filename = "document.pdf") {
  const { default: html2canvas } = await import("html2canvas");
  const { jsPDF } = await import("jspdf");

  // 直接对编辑器真实 DOM 渲染（布局所见即所得）。
  // 主题层颜色是 lab()/oklch()，html2canvas 无法解析：
  // 在 onclone 里把克隆树颜色统一换算成 RGB（只影响渲染副本，不动真实页面）。
  const source = editor.view.dom as HTMLElement;
  const canvas = await html2canvas(source, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (doc: Document, clonedEl: HTMLElement | undefined) => {
      if (!clonedEl) return;
      // 先在克隆 body 上换算颜色（含编辑器子树），再删除编辑态悬浮控件
      sanitizeColors(doc.body);
      const rootCs = getComputedStyle(doc.documentElement);
      if (COLOR_FUNCS.test(rootCs.backgroundColor)) {
        doc.documentElement.style.backgroundColor = toRgb(rootCs.backgroundColor);
      }
      COLOR_FUNCS.lastIndex = 0;
      clonedEl
        .querySelectorAll(
          ".ProseMirror-widget, [class*='tk-ct-toolbar-bridge'], [class*='tk-image-block-handle'], [class*='tk-callout-switcher'], [class*='tk-table-hover']",
        )
        .forEach((el) => el.remove());
      clonedEl.querySelectorAll("iframe, video, audio").forEach((el) => el.remove());
    },
  });

  // A4: 210mm x 297mm；内容等比缩放到「页宽 - 左右边距」，超出一页高度时分页
  const MARGIN = 15; // mm
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const contentH = pageH - MARGIN * 2;
  const pxPerMm = canvas.width / contentW;
  const pageHpx = Math.floor(contentH * pxPerMm);
  let rendered = 0;
  let page = 0;
  while (rendered < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - rendered);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, contentW, sliceH / pxPerMm);
    rendered += sliceH;
    page += 1;
  }
  await pdf.save(filename);
}

/* ── 服务端矢量 PDF（推荐的生产方案，消费方参考实现）── */

/** 收集同源样式表文本（跨域的样式表 cssRules 不可读，跳过）；
 * 相对路径资源（字体等）改写为绝对 URL，否则 headless 渲染的 about:blank 里解析不到 */
function collectCss(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      /* 跨域样式表无权访问，跳过 */
    }
  }
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, url: string) => {
    if (/^(data:|https?:)/.test(url)) return m;
    return `url(${q}${new URL(url, location.href).href}${q})`;
  });
}

/** 重建编辑器的祖先类名链：只保留 .tk-editor 等主题容器（跳过 demo 布局层，
 * 避免把入场动画/页面背景等演示样式带进服务端渲染） */
function buildAncestorChain(editorDom: Element): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let el: HTMLElement | null = editorDom.parentElement;
  while (el && el !== document.body) {
    if (/(^|\s)tk-editor(\s|$)/.test(el.className)) {
      const div = document.createElement(el.tagName);
      div.className = el.className;
      if (el.getAttribute("style")) div.setAttribute("style", el.getAttribute("style")!);
      chain.unshift(div);
    }
    el = el.parentElement;
  }
  return chain;
}

/**
 * 服务端导出：把编辑器克隆 DOM（保留主题类名）+ 同源 CSS 交给
 * /api/export-pdf，由 headless Chrome 渲染成矢量 PDF（文字可选中、
 * 分页由排版引擎处理）。对应消费方服务端 "headless Chrome + 打印样式" 的做法。
 */
export async function exportPdfServer(editor: Editor, filename = "document.pdf") {
  // 克隆编辑器 DOM 并剔除编辑态控件
  const clone = editor.view.dom.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      ".ProseMirror-widget, [class*='tk-ct-toolbar-bridge'], [class*='tk-image-block-handle'], [class*='tk-callout-switcher'], [class*='tk-table-hover']",
    )
    .forEach((el) => el.remove());
  // 服务端 Chrome 可以渲染 iframe/video；但为避免空白大块，替换为等高占位框
  // （注意：不能先 remove 再替换，否则节点树里已找不到媒体元素）
  const mediaHolders: Array<[Element, string]> = [];
  clone.querySelectorAll("iframe, video").forEach((el) => {
    mediaHolders.push([el, el.tagName]);
  });
  for (const [el, tag] of mediaHolders) {
    const h = (el as HTMLElement).offsetHeight || (tag === "video" ? 300 : 360);
    const holder = document.createElement("div");
    holder.style.cssText = `height:${h}px;border:1px dashed #cccccc;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999999;font-size:13px;`;
    holder.textContent = tag === "video" ? "视频（导出略）" : "嵌入内容（导出略）";
    el.replaceWith(holder);
  }

  // 标题孤行保护：Chrome 不支持 break-after: avoid，这里把每个标题和它的
  // 下一个块包进一个 break-inside: avoid 的分组，保证标题不落在页尾
  clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
    const parent = h.parentElement;
    const next = h.nextElementSibling;
    if (!parent || !next || h.closest(".tk-keep") || next.matches("h1, h2, h3, h4, h5, h6")) return;
    const keep = document.createElement("div");
    keep.className = "tk-keep";
    parent.insertBefore(keep, h);
    keep.appendChild(h);
    keep.appendChild(next);
  });
  clone.removeAttribute("contenteditable");

  // 祖先类名链由外向内嵌套，恢复主题/CSS 变量作用域（主题类挂在 <html> 上，
  // 由 themeClass 单独传给服务端；这里补齐 .tk-editor 等中间层）
  const outer = document.createElement("div");
  outer.className = "tk-pdf-print";
  let parent: HTMLElement = outer;
  for (const div of buildAncestorChain(editor.view.dom)) {
    parent.appendChild(div);
    parent = div;
  }
  parent.appendChild(clone);

  const res = await fetch("/api/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: outer.outerHTML,
      css: collectCss(),
      themeClass: document.documentElement.className,
    }),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`服务端导出失败：${message}`);
  }
  const blob = await res.blob();
  download(blob, filename);
}
