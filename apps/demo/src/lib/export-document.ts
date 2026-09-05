import type { Editor } from "@tiptap/react";
import { createSerializer } from "@tipkit/core";

import { Packer } from "docx";
import { buildDocx } from "./html-to-docx";

/* Demo 导出助手：Markdown / Word(docx) / PDF（服务端矢量）。
 * - Markdown：createSerializer 的 toMarkdown 契约
 * - Word：docx 库 + 「编辑器 DOM → docx」转换器（读计算样式，含 lab/oklch 颜色换算）
 * - PDF：编辑器克隆 DOM + 同源 CSS 交给 /api/export-pdf，headless Chrome 渲染矢量 PDF
 */

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
  // 勾选框状态：cloneNode 只拷贝 attribute 不拷贝 property，
  // 已勾选的 checked 属性要按 data-checked 补回来，否则打印全是不勾选样式
  clone
    .querySelectorAll('li[data-checked="true"] input[type="checkbox"]')
    .forEach((i) => i.setAttribute("checked", ""));
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


