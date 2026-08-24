"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { useT } from "@tipkit/core";

/* 目录节点（迁移自 blog rich-text/ext/toc-node.tsx）：
 * 插入后自动扫描文档 heading 并渲染列表，点击跳转。 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableOfContentsNode: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

interface HeadingInfo {
  id: string;
  text: string;
  level: number;
  pos: number;
}

function collectHeadings(doc: NodeViewProps["editor"]["state"]["doc"]): HeadingInfo[] {
  const items: HeadingInfo[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      items.push({
        id: `toc-${pos}`,
        text: node.textContent.slice(0, 60) || "（空标题）",
        level: node.attrs.level,
        pos,
      });
    }
    return true;
  });
  return items;
}

function TocView(props: NodeViewProps) {
  const { editor, extension } = props;
  const t = useT();
  const scrollOffset = (extension.options.scrollOffset ?? 0) as number;
  const [items, setItems] = useState<HeadingInfo[]>([]);

  useEffect(() => {
    const update = () => setItems(collectHeadings(editor.state.doc));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const jump = (pos: number) => {
    editor.commands.setTextSelection(pos + 1);
    editor.commands.focus(undefined, { scrollIntoView: false });
    requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        const top = dom.getBoundingClientRect().top + window.scrollY - scrollOffset;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  };

  return (
    <NodeViewWrapper>
      <div className="tk-toc" contentEditable={false}>
        <div className="tk-toc-title">{t("toc.title")}</div>
        {items.length === 0 ? (
          <div className="tk-toc-empty">{t("toc.empty")}</div>
        ) : (
          <ul className="tk-toc-list">
            {items.map((item) => (
              <li
                key={item.id}
                style={{ paddingLeft: `${(item.level - 1) * 14}px` }}
                className="tk-toc-item"
                onClick={() => jump(item.pos)}
              >
                <span className="tk-toc-dot">·</span>
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const TableOfContentsNode = Node.create({
  name: "tableOfContentsNode",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  inline: false,

  addOptions() {
    return {
      /**
       * 点击目录项滚动到标题时，距离视口顶部的偏移量（像素）。
       * 用于避开固定定位的 header / 工具栏等遮挡元素。
       * @default 0
       */
      scrollOffset: 0,
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='table-of-content']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "table-of-content" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands, state }) => {
          const { schema } = state;
          const paragraph = schema.nodes.paragraph?.create() ?? null;
          if (!paragraph) return commands.insertContent({ type: this.name });
          return commands.insertContent([{ type: this.name }, paragraph.toJSON()]);
        },
    };
  },
});

export default TableOfContentsNode;
