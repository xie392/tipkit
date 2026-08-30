"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";

/* 多栏容器：含至少一个 column 子节点（column+，支持任意列数）。
 * columns 不是 atom，自动设 NodeSelection 会把内部文本整块高亮变灰，
 * 因此悬浮工具栏保留完整操作（布局切换 + 复制块 + 删除块）；
 * 单列的增删由 column 自身悬浮工具完成。 */

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
      /** 在 pos 所指 column 的右侧插入一个空列（pos 为该 column 节点起始位置） */
      insertColumnAfter: (pos: number) => ReturnType;
      /** 删除 pos 所指 column；若为容器内最后一列，拆掉整个分栏并提升列内内容 */
      deleteColumnAt: (pos: number) => ReturnType;
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

function IconDuplicate() {
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

const LAYOUTS: { value: ColumnLayout; labelKey: string; icon: React.ReactNode }[] = [
  { value: ColumnLayout.TwoColumn, labelKey: "columns.twoColumn", icon: <IconTwoCol /> },
  { value: ColumnLayout.SidebarLeft, labelKey: "columns.sidebarLeft", icon: <IconLeftNarrow /> },
  { value: ColumnLayout.SidebarRight, labelKey: "columns.sidebarRight", icon: <IconRightNarrow /> },
];

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

/** 单列悬浮工具：右侧加列 / 删除本列 */
function ColumnView({ editor, getPos }: NodeViewProps) {
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const [hovered, setHovered] = useState(false);

  return (
    <NodeViewWrapper
      className={`tk-column${isEditable && hovered ? " is-hovered" : ""}`}
      onMouseEnter={() => isEditable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-type="column"
    >
      {isEditable && hovered && (
        <div className="tk-column-actions" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
          <button
            type="button"
            data-tip={t("columns.addColumn")}
            aria-label={t("columns.addColumn")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const pos = getPos();
              if (typeof pos === "number") editor.chain().focus().insertColumnAfter(pos).run();
            }}
          >
            <IconPlus />
          </button>
          <button
            type="button"
            data-tip={t("columns.deleteColumn")}
            aria-label={t("columns.deleteColumn")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const pos = getPos();
              if (typeof pos === "number") editor.chain().focus().deleteColumnAt(pos).run();
            }}
          >
            <IconX />
          </button>
        </div>
      )}
      <NodeViewContent as="div" />
    </NodeViewWrapper>
  );
}

function ColumnsView({ editor, node, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const layout = (node.attrs.layout as ColumnLayout) ?? ColumnLayout.TwoColumn;
  const [hovered, setHovered] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(wrapRef);
  const { visible, show, hide } = useToolbarVisibility();

  useEffect(() => {
    if (!isEditable) setHovered(false);
  }, [isEditable]);

  const handleDuplicate = useCallback(() => {
    if (!isEditable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
  }, [editor, node, getPos, isEditable]);

  const handleDelete = useCallback(() => {
    if (!isEditable) return;
    deleteNode();
  }, [isEditable, deleteNode]);

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`tk-columns-wrap layout-${layout} tk-hover-toolbar${isEditable ? " is-editable" : ""}${hovered ? " is-hovered" : ""}`}
      style={{ "--tk-columns-n": node.childCount } as React.CSSProperties}
      onMouseEnter={() => {
        if (isEditable) {
          setHovered(true);
          show();
        }
      }}
      onMouseLeave={() => {
        setHovered(false);
        hide();
      }}
      data-type="columns"
    >
      {isEditable && (
        <div
          className={`tk-ct-toolbar-bridge ${placement === "bottom" ? "is-bottom" : "is-top"}${visible ? " is-visible" : ""}`}
          contentEditable={false}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="tk-ct-toolbar">
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                data-tip={t(l.labelKey)}
                aria-label={t(l.labelKey)}
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
              data-tip={t("block.duplicate")}
              aria-label={t("block.duplicate")}
              className="tk-ct-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconDuplicate />
            </button>
            <button
              type="button"
              data-tip={t("block.delete")}
              aria-label={t("block.delete")}
              className="tk-ct-btn is-danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDelete}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
      <NodeViewContent className="tk-columns-grid" as="div" />
    </NodeViewWrapper>
  );
}

export const Columns = Node.create({
  name: "columns",

  group: "block",

  content: "column+",

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
      insertColumnAfter:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const col = tr.doc.resolve(pos).nodeAfter;
          if (!col || col.type.name !== "column") return false;
          const empty = col.type.createAndFill();
          if (!empty) return false;
          dispatch?.(tr.insert(pos + col.nodeSize, empty));
          return true;
        },
      deleteColumnAt:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const $pos = tr.doc.resolve(pos);
          const col = $pos.nodeAfter;
          if (!col || col.type.name !== "column" || $pos.parent.type.name !== "columns") return false;
          if ($pos.parent.childCount <= 1) {
            // 最后一列：移除整个分栏容器，列内块提升到原文档位置
            dispatch?.(tr.replaceWith($pos.before(), $pos.after(), col.content));
          } else {
            dispatch?.(tr.delete(pos, pos + col.nodeSize));
          }
          return true;
        },
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

  addNodeView() {
    return ReactNodeViewRenderer(ColumnView);
  },
});

export default Columns;
