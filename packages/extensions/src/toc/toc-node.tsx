"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useT, useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";

/* 目录节点（迁移自 blog rich-text/ext/toc-node.tsx）：
 * 插入后自动扫描文档 heading 并渲染列表，点击跳转。
 * 交互：与其他块统一，编辑态悬停显示「复制 / 删除」工具栏 + 小边框。 
 */

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

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
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
  const { editor, extension, node, getPos, deleteNode } = props;
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(rootRef);
  const { visible, show, hide } = useToolbarVisibility();
  const [hovered, setHovered] = useState(false);
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

  const handleDuplicate = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
  };

  return (
    <NodeViewWrapper
      ref={rootRef}
      className={`tk-toc-wrap tk-hover-toolbar${isEditable ? " is-editable" : ""}${hovered ? " is-hovered" : ""}`}
      onMouseEnter={() => {
        if (isEditable) setHovered(true);
        show();
      }}
      onMouseLeave={() => {
        setHovered(false);
        hide();
      }}
    >
      {isEditable && (
        <div
          className={`tk-ct-toolbar-bridge ${placement === "bottom" ? "is-bottom" : "is-top"}${visible ? " is-visible" : ""}`}
          contentEditable={false}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="tk-ct-toolbar">
            <button
              type="button"
              className="tk-ct-btn"
              data-tip={t("block.duplicate")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconCopy />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              className="tk-ct-btn is-danger"
              data-tip={t("block.delete")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteNode()}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
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
