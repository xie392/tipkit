import { mergeAttributes, Node, InputRule } from "@tiptap/core";
import { emojiLibrary } from "../shared/emoji/emoji-data";

/* Emoji 节点：inline atom，短代码 `:name:` 输入规则 / 从数据表选择后插入。
 * 渲染 <span class="tk-emoji" data-name>😀</span>；Markdown 导出还原为 :name:。
 * （Markdown 导入不含自定义 tokenizer，粘贴 :name: 文本不会转换——由输入规则覆盖打字场景。） */

export interface EmojiAttrs {
  /** 短代码名，如 "smile" */
  name: string;
  /** emoji 字符 */
  glyph: string;
}

export interface EmojiOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emoji: {
      insertEmoji: (name: string) => ReturnType;
    };
  }
}

export function findEmoji(name: string): { name: string; emoji: string } | undefined {
  const key = name.trim().toLowerCase();
  return emojiLibrary.find((e) => e.name === key);
}

export const Emoji = Node.create<EmojiOptions>({
  name: "emoji",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addOptions() {
    return { HTMLAttributes: { class: "tk-emoji" } };
  },

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-name") ?? "",
        renderHTML: (a) => ({ "data-name": a.name }),
      },
      glyph: {
        default: "",
        parseHTML: (el) => el.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span.tk-emoji[data-name]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as EmojiAttrs;
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-name": attrs.name,
      }),
      attrs.glyph || "🙂",
    ];
  },

  renderText({ node }) {
    return (node.attrs as EmojiAttrs).glyph || `:${(node.attrs as EmojiAttrs).name}:`;
  },

  addCommands() {
    return {
      insertEmoji:
        (name: string) =>
        ({ chain }) => {
          const found = findEmoji(name);
          if (!found) return false;
          return chain()
            .insertContent({
              type: this.name,
              attrs: { name: found.name, glyph: found.emoji },
            })
            .run();
        },
    };
  },

  addInputRules() {
    return [
      // 自定义 InputRule：未知短代码不替换（nodeInputRule 无法条件跳过）
      new InputRule({
        find: /(?:^|\s):([a-z0-9_+-]+):$/i,
        handler: ({ state, range, match }) => {
          const found = findEmoji(match[1]);
          if (!found) return;
          // match[0] 开头可能带一个空格（(?:^|\s)），替换时保留
          const prefixLen = match[0].startsWith(" ") ? 1 : 0;
          const { tr } = state;
          tr.replaceWith(range.from + prefixLen, range.to, this.type.create({ name: found.name, glyph: found.emoji }));
        },
      }),
    ];
  },

  // @tiptap/markdown v3：注册 Markdown 导出（:name: 短代码）
  markdownTokenName: "emoji",
  renderMarkdown(node) {
    const attrs = (node as { attrs: EmojiAttrs }).attrs;
    return attrs.name ? `:${attrs.name}:` : (attrs.glyph ?? "");
  },
});
