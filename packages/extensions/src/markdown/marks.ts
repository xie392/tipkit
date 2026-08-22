import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import { safeMarkInputRule } from "./safe-mark-input-rule";

/* 行内 markdown 输入规则（迁移自 blog rich-text/markdown-marks.ts）。
 * Tiptap 3.x 内置 markInputRule 在空段落场景下 tr.addMark 会因
 * 位置映射崩溃，这里用 safeMarkInputRule 覆盖。
 * 正则去掉官方的前导空白要求：中文/英文无空格语境下输入闭合符号即可转换。
 */

const boldStarRegex = /(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
const boldUnderscoreRegex = /(__(?!\s+__)((?:[^_]+))__(?!\s+__))$/;
// 斜体开头加 (?<!\*)/(?<!_) 守卫：避免在输入 **加粗** 的第一个闭合 * 时，
// 斜体规则抢先匹配 "*加粗*"，把加粗误转成斜体。
const italicStarRegex = /(?<!\*)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
const italicUnderscoreRegex = /(?<!_)(_(?!\s+)((?:[^_]+))_(?!\s+_))$/;
const strikeRegex = /(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;

const codeInputMatch = (text: string) => {
  const match = /`([^`]+)`(?!`)$/.exec(text);
  if (!match) return null;
  if (match.index > 0 && text[match.index - 1] === "`") return null;
  return {
    index: match.index,
    text: match[0],
    replaceWith: match[1],
  };
};

export const CustomBold = Bold.extend({
  addInputRules() {
    return [
      safeMarkInputRule({ find: boldStarRegex, type: this.type }),
      safeMarkInputRule({ find: boldUnderscoreRegex, type: this.type }),
    ];
  },
});

export const CustomItalic = Italic.extend({
  addInputRules() {
    return [
      safeMarkInputRule({ find: italicStarRegex, type: this.type }),
      safeMarkInputRule({ find: italicUnderscoreRegex, type: this.type }),
    ];
  },
});

export const CustomStrike = Strike.extend({
  addInputRules() {
    return [safeMarkInputRule({ find: strikeRegex, type: this.type })];
  },
});

export const CustomCode = Code.extend({
  addInputRules() {
    return [safeMarkInputRule({ find: codeInputMatch, type: this.type })];
  },
});
