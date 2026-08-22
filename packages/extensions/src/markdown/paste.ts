import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { MarkdownManager } from "@tiptap/markdown";

/* Markdown 粘贴（迁移自 blog rich-text/markdown-paste.ts）。
 * 粘贴纯文本 Markdown 时自动解析为富文本节点，依赖 @tiptap/markdown。
 * 富文本（带 text/html）粘贴仍交给 ProseMirror 默认处理。 */

/** 判断纯文本是否带明显的 Markdown 语法特征（标题/列表/引用/代码块/链接/加粗等） */
function looksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~)/.test(text) ||
    /\*\*[^*\n]+\*\*|__[^_\n]+__/.test(text) ||
    /\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_/.test(text) ||
    /~~[^~\n]+~~/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /\[[^\]]+\]\([^)\s]+\)/.test(text) ||
    /(^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(\n|$)/.test(text)
  );
}

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(_view, event) {
            const manager = editor.markdown as MarkdownManager | undefined;
            if (!manager) return false;

            const html = event.clipboardData?.getData("text/html") ?? "";
            if (html.trim()) return false;

            const text = event.clipboardData?.getData("text/plain") ?? "";
            if (!text.trim() || !looksLikeMarkdown(text)) return false;

            editor.commands.insertContent(text, { contentType: "markdown" });
            return true;
          },
        },
      }),
    ];
  },
});
