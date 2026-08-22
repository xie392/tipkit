import { InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Link as BuiltInLink } from "@tiptap/extension-link";
import { safeMarkInputRule } from "./safe-mark-input-rule";

/* Markdown 链接输入规则（迁移自 blog rich-text/markdown-link.ts）：
 *   [文字](https://...) → 链接（显示文字，href 指向 url）
 *   https://xxx / www.xxx → 裸 URL 自动加链接（行尾空格触发）
 * 中文友好：链接文字允许中文、字母、数字、空格、-、_、/。
 */

// [文字](url) → group1=文字、group2=url；不使用 g/m 标志，避免 lastIndex 问题
const markdownLinkRegex = /\[([\w一-龥\s\-_/|]+)\]\((https?:\/\/\S+?)\)$/;

// 裸 URL：捕获组 1=url（行尾空格触发）
const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)(?:\s|\n)$/;

const markdownLinkInputRule = new InputRule({
  find: markdownLinkRegex,
  handler: ({ state, range, match }) => {
    const label = match[1];
    const href = match[2];
    if (!label || !href) return null;

    const linkType = state.schema.marks.link;
    if (!linkType) return null;

    const tr = state.tr;
    tr.delete(range.from, range.to);
    tr.insertText(label, range.from);
    tr.addMark(range.from, range.from + label.length, linkType.create({ href }));
    // 光标移到链接文字之后，脱离 link mark
    const afterPos = range.from + label.length;
    tr.setSelection(TextSelection.create(tr.doc, afterPos));
    tr.removeStoredMark(linkType);
    // 阻止 autolink 插件在本次事务后重复处理
    tr.setMeta("preventAutolink", true);
  },
});

const getUrlAttrs = (match: RegExpMatchArray) => ({ href: match[1] });

export const MarkdownLink = BuiltInLink.extend({
  addInputRules() {
    return [
      markdownLinkInputRule,
      safeMarkInputRule({
        find: urlRegex,
        type: this.type,
        getAttributes: getUrlAttrs as never,
      }),
    ];
  },
}).configure({
  openOnClick: false,
  linkOnPaste: true,
  autolink: true,
  defaultProtocol: "https",
  HTMLAttributes: {
    rel: "noopener noreferrer nofollow",
  },
});
