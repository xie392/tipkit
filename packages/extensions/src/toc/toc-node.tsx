"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";

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
  const { editor } = props;
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
    editor.commands.setNodeSelection(pos);
    editor.commands.focus();
    requestAnimationFrame(() => {
      const res = editor.view.domAtPos(pos);
      const node = res.node as unknown;
      if (node instanceof Element) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  return (
    <NodeViewWrapper>
      <div className="tk-toc" contentEditable={false}>
        <div className="tk-toc-title">▍本页目录</div>
        {items.length === 0 ? (
          <div className="tk-toc-empty">还没有标题，添加标题后这里会自动生成目录。</div>
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
