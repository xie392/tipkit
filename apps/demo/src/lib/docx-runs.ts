import { ExternalHyperlink, TextRun, type ParagraphChild } from "docx";

import { cssColorToHex } from "./docx-colors";

export const FONT_FALLBACK = "Calibri";
export const FONT_MONO = "Courier New";

/* 一个连续文本片段的样式快照（来自 getComputedStyle） */
export interface TextStyle {
  text: string;
  color: string | null;
  /** 行内高亮（highlight mark / span 背景）→ docx shading */
  bg: string | null;
  sizeHalfPt: number | null;
  bold: boolean;
  italics: boolean;
  underline: boolean;
  strike: boolean;
  vAlign: "baseline" | "subscript" | "superscript";
  font: string;
  /** 所在 <a href> 的绝对 URL，非空时输出为真超链接 */
  href: string | null;
}

const TRANSPARENT_BG = "rgba(0, 0, 0, 0)";

export function styleOfText(el: Element, text: string): TextStyle {
  const cs = getComputedStyle(el);
  const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const isMono = /monospace|courier/i.test(cs.fontFamily);
  const anchor = el.closest("a[href]") as HTMLAnchorElement | null;
  return {
    text,
    color: cssColorToHex(cs.color),
    bg: cs.backgroundColor === TRANSPARENT_BG ? null : cssColorToHex(cs.backgroundColor),
    sizeHalfPt: Math.round(parseFloat(cs.fontSize) * 0.75 * 2),
    bold: Number(cs.fontWeight) >= 600,
    italics: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
    underline: cs.textDecorationLine.includes("underline"),
    strike: cs.textDecorationLine.includes("line-through"),
    vAlign:
      cs.verticalAlign === "sub" ? "subscript" : cs.verticalAlign === "super" ? "superscript" : "baseline",
    font: isMono ? FONT_MONO : family || FONT_FALLBACK,
    href: anchor?.href ?? null,
  };
}

const EMPTY_BR_RUN: TextStyle = {
  text: "\n", color: null, bg: null, sizeHalfPt: null, bold: false, italics: false,
  underline: false, strike: false, vAlign: "baseline", font: FONT_FALLBACK, href: null,
};

function buildRun(s: TextStyle, inLink: boolean): TextRun {
  return new TextRun({
    text: s.text,
    bold: s.bold || undefined,
    italics: s.italics || undefined,
    underline: (s.underline || inLink) ? {} : undefined,
    strike: s.strike || undefined,
    subScript: s.vAlign === "subscript" || undefined,
    superScript: s.vAlign === "superscript" || undefined,
    color: s.color ?? undefined,
    size: s.sizeHalfPt ?? undefined,
    shading: s.bg ? { fill: s.bg } : undefined,
    font: s.font,
    // Hyperlink 字符样式保证 Word/WPS 识别为链接；颜色仍用主题计算值保持观感一致
    style: inLink ? "Hyperlink" : undefined,
  });
}

export function toRun(s: TextStyle): ParagraphChild {
  if (s.href) {
    return new ExternalHyperlink({ link: s.href, children: [buildRun({ ...s, href: null }, true)] });
  }
  return buildRun(s, false);
}

export function sameStyle(a: TextStyle, b: TextStyle): boolean {
  return (
    a.color === b.color && a.bg === b.bg && a.sizeHalfPt === b.sizeHalfPt && a.bold === b.bold &&
    a.italics === b.italics && a.underline === b.underline && a.strike === b.strike &&
    a.vAlign === b.vAlign && a.font === b.font && a.href === b.href
  );
}

/** 合并相邻同样式的片段，避免 docx 里碎片化；href 不同的链接各自成段 */
export function mergeStyled(runs: TextStyle[]): ParagraphChild[] {
  const merged: TextStyle[] = [];
  for (const r of runs) {
    if (r.text.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last && sameStyle(last, r)) last.text += r.text;
    else merged.push({ ...r });
  }
  return merged.map(toRun);
}

/** 收集一个块内所有文本节点（跳过嵌套列表/表格/隐藏无障碍文案），按计算样式生成片段。
 * preserveWhitespace 用于 <pre>/<code>：保留原始缩进与空格 */
export function collectStyled(root: Element, preserveWhitespace = false): TextStyle[] {
  const runs: TextStyle[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const parent = node.parentElement;
      if (!parent || text.length === 0) return;
      // 任务项的 <label> 里是视觉隐藏的无障碍文案，会造成内容重复
      if (parent.closest("label")) return;
      // 纯空白文本节点：HTML 渲染时折叠为一个空格，docx 里也输出一个空格，
      // 否则语法高亮的相邻 span 之间会丢失空格（export default → exportdefault）
      if (!text.trim() && !preserveWhitespace) {
        runs.push(styleOfText(parent, " "));
        return;
      }
      runs.push(styleOfText(parent, text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol" || tag === "table" || tag === "label" || tag === "input") return;
    if (tag === "br") {
      runs.push({ ...EMPTY_BR_RUN });
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return runs;
}

export function collectRuns(root: Element): ParagraphChild[] {
  return mergeStyled(collectStyled(root));
}
