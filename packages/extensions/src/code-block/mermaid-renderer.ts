"use client";

import type { Mermaid } from "mermaid";

let mermaidPromise: Promise<Mermaid> | null = null;
let initializedTheme: string | null = null;

async function loadMermaid(theme: string): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  const mermaid = await mermaidPromise;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
      // 不按容器宽度压缩 SVG，保持原始尺寸（大图由预览区横向滚动查看）
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      class: { useMaxWidth: false },
      state: { useMaxWidth: false },
      er: { useMaxWidth: false },
      journey: { useMaxWidth: false },
      pie: { useMaxWidth: false },
      gitGraph: { useMaxWidth: false },
    });
    initializedTheme = theme;
  }
  return mermaid;
}

function extractErrorMessage(err: unknown): string {
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  // mermaid 的解析错误信息里常内嵌完整 DOM/HTML，仅保留纯文本
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** 渲染 mermaid 源码为 SVG 字符串；失败时抛出可读错误 */
export async function renderMermaid(code: string, theme: string): Promise<string> {
  const mermaid = await loadMermaid(theme);
  const id = `tk-mermaid-${Math.random().toString(36).slice(2)}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (err) {
    // render 失败后残留的临时 DOM 会污染文档，清理之
    document.getElementById(`d${id}`)?.remove();
    throw new Error(extractErrorMessage(err));
  }
}
