"use client";

import { mergeAttributes, Node as TiptapNode, wrappingInputRule } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutView } from "./callout-view";

/* Callout 提示框（迁移自 blog rich-text/ext/callout.tsx）。
 * 预设 5 种风格；属性 variant / emoji；内容由 NodeViewContent 承载。
 * 变体配色（.tk-callout-{variant}）归 @tipkit/themes，本目录零视觉。 */

export type CalloutVariant = "info" | "success" | "warning" | "danger" | "note";

/** 各变体的默认 emoji（内容语义，非视觉样式） */
export const CALLOUT_VARIANT_EMOJIS: Record<CalloutVariant, string> = {
  info: "💡",
  success: "✅",
  warning: "⚠️",
  danger: "🔥",
  note: "📝",
};

export const CALLOUT_VARIANTS: CalloutVariant[] = ["info", "success", "warning", "danger", "note"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
      setCalloutVariant: (variant: CalloutVariant) => ReturnType;
      setCalloutEmoji: (emoji: string) => ReturnType;
    };
  }
}

export const Callout = TiptapNode.create({
  name: "callout",
  content: "paragraph+",
  group: "block",
  defining: true,
  draggable: true,
  selectable: false,

  addOptions() {
    return { HTMLAttributes: { class: "tk-callout" } };
  },

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-variant") ?? "info",
        renderHTML: (a) => ({ "data-variant": a.variant }),
      },
      emoji: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-emoji") ?? null,
        renderHTML: (a) => (a.emoji ? { "data-emoji": a.emoji } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-callout" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const variant = (attrs["data-variant"] as CalloutVariant) ?? "info";
    const emoji = (attrs["data-emoji"] as string) ?? CALLOUT_VARIANT_EMOJIS[variant] ?? CALLOUT_VARIANT_EMOJIS.info;
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-variant": variant,
        "data-emoji": emoji,
      }),
      ["div", { class: "tk-callout-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands, state }) => {
          const { selection } = state;
          const isEmptyParagraphNodeSelection =
            selection instanceof NodeSelection &&
            selection.node.type.name === "paragraph" &&
            selection.node.content.size === 0;

          if (selection.empty || isEmptyParagraphNodeSelection) {
            return commands.insertContent({
              type: "callout",
              attrs: { variant: "info" },
              content: [{ type: "paragraph" }],
            });
          }
          return commands.toggleWrap("callout");
        },
      setCalloutVariant:
        (variant) =>
        ({ commands }) =>
          commands.updateAttributes("callout", { variant }),
      setCalloutEmoji:
        (emoji) =>
        ({ commands }) =>
          commands.updateAttributes("callout", { emoji }),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^>!$/,
        type: this.type,
        getAttributes: () => ({ variant: "info" }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

export default Callout;
