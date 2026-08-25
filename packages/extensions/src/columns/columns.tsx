"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useState } from "react";
import { useT } from "@tipkit/core";

/* 多栏容器：含两个 column 子节点。
 * ReactNodeView 自带 hover 工具栏：鼠标悬停分栏时在顶部显示布局切换按钮，
 * 不依赖 NodeSelection，避免点击时内部文本被全选变灰。 */

export enum ColumnLayout {
  SidebarLeft = "sidebar-left",
  SidebarRight = "sidebar-right",
  TwoColumn = "two-column",
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      setColumns: () => ReturnType;
      setLayout: (layout: ColumnLayout) => ReturnType;
    };
  }
}

function IconTwoCol() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="5.5" height="10" rx="1" />
      <rect x="8.5" y="3" width="5.5" height="10" rx="1" />
    </svg>
  );
}

function IconLeftNarrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="3.5" height="10" rx="1" />
      <rect x="6.5" y="3" width="7.5" height="10" rx="1" />
    </svg>
  );
}

function IconRightNarrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="7.5" height="10" rx="1" />
      <rect x="10.5" y="3" width="3.5" height="10" rx="1" />
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

function IconDuplicate() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

const LAYOUTS: { value: ColumnLayout; labelKey: string; icon: React.ReactNode }[] = [
  { value: ColumnLayout.TwoColumn, labelKey: "columns.twoColumn", icon: <IconTwoCol /> },
  { value: ColumnLayout.SidebarLeft, labelKey: "columns.sidebarLeft", icon: <IconLeftNarrow /> },
  { value: ColumnLayout.SidebarRight, labelKey: "columns.sidebarRight", icon: <IconRightNarrow /> },
];

function ColumnsView({ editor, node, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useT();
  const layout = (node.attrs.layout as ColumnLayout) ?? ColumnLayout.TwoColumn;
  const [hovered, setHovered] = useState(false);

  const handleDelete = useCallback(() => {
    if (!editor.isEditable) return;
    deleteNode();
  }, [editor.isEditable, deleteNode]);

  const handleDuplicate = useCallback(() => {
    if (!editor.isEditable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    const nodeSize = node.nodeSize;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + nodeSize, node.toJSON())
      .run();
  }, [editor, node, getPos]);

  return (
    <NodeViewWrapper
      className={`tk-columns-wrap layout-${layout}${hovered ? " is-hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-type="columns"
    >
      {hovered && editor.isEditable && (
        <div className="tk-columns-toolbar" contentEditable={false}>
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              title={t(l.labelKey)}
              className={`tk-ct-btn${layout === l.value ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ layout: l.value })}
            >
              {l.icon}
            </button>
          ))}
          <span className="tk-ct-sep" />
          <button
            type="button"
            title={t("block.duplicate")}
            className="tk-ct-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDuplicate}
          >
            <IconDuplicate />
          </button>
          <button
            type="button"
            title={t("block.delete")}
            className="tk-ct-btn is-danger"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDelete}
          >
            <IconTrash />
          </button>
        </div>
      )}
      <NodeViewContent className="tk-columns-grid" as="div" />
    </NodeViewWrapper>
  );
}

export const Columns = Node.create({
  name: "columns",

  group: "block",

  content: "column column",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: ColumnLayout.TwoColumn,
      },
    };
  },

  addCommands() {
    return {
      setColumns:
        () =>
        ({ commands }) =>
          commands.insertContent(
            '<div data-type="columns"><div data-type="column" data-position="left"><p></p></div><div data-type="column" data-position="right"><p></p></div></div>',
          ),
      setLayout:
        (layout: ColumnLayout) =>
        ({ commands }) =>
          commands.updateAttributes("columns", { layout }),
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='columns']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-type": "columns", class: `tk-columns-wrap layout-${HTMLAttributes.layout}` },
      ["div", { class: "tk-columns-grid" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsView);
  },
});

/** 单个列：内部可放任意 block */
export const Column = Node.create({
  name: "column",

  content: "block+",

  isolating: true,

  selectable: false,

  draggable: false,

  addAttributes() {
    return {
      position: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-position") ?? "",
        renderHTML: (attributes) => ({ "data-position": attributes.position }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "column", class: "tk-column" }),
      0,
    ];
  },

  parseHTML() {
    return [{ tag: "div[data-type='column']" }];
  },
});

export default Columns;
