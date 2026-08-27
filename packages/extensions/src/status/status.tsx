"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { StatusView } from "./status-view";

/* Status 状态标签（Confluence /status 风格的内联原子节点）。
 * 视觉 class tk-status，背景色为节点数据（内联 style，随节点存储），
 * 其余所有视觉样式统一在 themes/base.css 的 .tk-status / .tk-status-popover。
 * 数据通过 data-text / data-color 做 HTML 序列化往返（复制粘贴 / 文档持久化）。 */

export interface StatusAttrs {
  text: string;
  color: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    status: {
      setStatus: (attrs?: Partial<StatusAttrs>) => ReturnType;
      updateStatus: (attrs: Partial<StatusAttrs>) => ReturnType;
    };
  }
}

export const Status = Node.create({
  name: "status",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      text: {
        default: "待处理",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-text") ?? "待处理",
        renderHTML: (attributes) => ({ "data-text": attributes.text }),
      },
      color: {
        default: "#ffcccc",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-color") ?? "#ffcccc",
        renderHTML: (attributes) => ({ "data-color": attributes.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-status]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "tk-status",
        "data-status": "true",
      }),
    ];
  },

  addCommands() {
    return {
      setStatus:
        (attrs) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: "status",
              attrs: {
                text: attrs?.text ?? "待处理",
                color: attrs?.color ?? "#ffcccc",
              },
            })
            .run(),
      updateStatus:
        (attrs) =>
        ({ chain }) =>
          chain().focus().updateAttributes("status", attrs).run(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatusView);
  },
});

export default Status;
