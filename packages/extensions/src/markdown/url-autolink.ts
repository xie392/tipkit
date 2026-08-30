import { Extension } from "@tiptap/core";

/* 裸 URL 自动识别（marked url tokenizer 覆盖）：
 * @tiptap/markdown 内置的 GFM 裸 URL 规则为 [^\s<]*，会把中文、全角标点
 * （如 "http://localhost:3000）、点右上角…"）一并吞进 href。
 * 这里用更严格的规则覆盖：URL 仅含 ASCII 合法字符，遇到 CJK / 全角标点
 * 即停止；尾部不成对的 ")" 与标点回退为正文。
 * 不匹配时返回 undefined，marked 会回退到内置 tokenizer（保留 <url> 等行为）。
 */

/** URL 主体：ASCII 字母数字 + RFC 3986 常见保留字符（含百分号编码） */
const URL_BODY = /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

/** 尾部需要回退的 ASCII 标点（常见句子结尾符号） */
const TRAILING_PUNCTUATION = /[.,;:!?'"*_~…]+$/;

function balanceParens(url: string): string {
  while (url.endsWith(")")) {
    const open = (url.match(/\(/g) ?? []).length;
    const close = (url.match(/\)/g) ?? []).length;
    if (close > open) {
      url = url.slice(0, -1);
    } else {
      break;
    }
  }
  return url;
}

/** marked start 钩子：提示可能匹配的起点，避免对每个内联片段都跑 tokenizer */
function start(src: string): number {
  return src.search(/https?:\/\/|www\./i);
}

function tokenize(src: string) {
  const schemeMatch = /^(?:https?:\/\/|www\.)/i.exec(src);
  if (!schemeMatch) return undefined;

  const bodyMatch = URL_BODY.exec(src.slice(schemeMatch.index + schemeMatch[0].length));
  // 纯 scheme 无后续字符（如行尾 "http://"）不构成链接，交给默认行为
  if (!bodyMatch?.[0]) return undefined;
  let url = schemeMatch[0] + bodyMatch[0];

  url = balanceParens(url);
  url = url.replace(TRAILING_PUNCTUATION, "");
  if (/^www\./i.test(url)) url = `https://${url}`;

  return {
    type: "link",
    raw: url,
    href: url,
    tokens: [{ type: "text", raw: url, text: url }],
  };
}

/** 覆盖 marked 内置 "url" tokenizer 的裸 URL 识别 */
export const UrlAutolink = Extension.create({
  name: "urlAutolink",
  markdownTokenizer: {
    name: "url",
    level: "inline" as const,
    start,
    tokenize,
  },
});
