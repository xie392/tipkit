import type { MarkdownParseHelpers, MarkdownToken, MarkdownTokenizer } from "@tiptap/core";

/* KaTeX Markdown 规格：块级 $$...$$ 双向转换。
 * 导出：单行公式输出 $$x$$，多行公式输出独立行的 $$ 块；
 * 导入：block 级 tokenizer 识别 $$...$$（含多行）。 */

export const katexMarkdownTokenizer: MarkdownTokenizer = {
  name: "katex",
  level: "block",
  start(src) {
    const index = src.indexOf("$$");
    return index !== -1 ? index : -1;
  },
  tokenize(src) {
    const match = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src);
    if (!match) return;
    return {
      type: "katex",
      raw: match[0],
      text: match[1].trim(),
    };
  },
};

export function parseKatexMarkdown(token: MarkdownToken, h: MarkdownParseHelpers) {
  return h.createNode("katex", { text: (token.text ?? "").trim() });
}

export function renderKatexMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.includes("\n") ? `$$\n${trimmed}\n$$` : `$$${trimmed}$$`;
}
