"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { getActiveBlockPos, blockHandlesKey } from "@tipkit/extensions";
import { useT, useEditorEditable } from "@tipkit/core";
import {
  IconCopy,
  IconScissors,
  IconTrash,
  IconPlusBelow,
  IconTransform,
  IconColumns,
  IconChevronRight,
} from "./block-actions/icons";

interface ActiveBlock {
  pos: number;
  nodeSize: number;
  typeName: string;
}

interface Anchor {
  right: number;
  top: number;
}

const GAP = 8;

const TURN_INTO_TARGETS = [
  { id: "p", labelKey: "blockHandle.turnInto.p" },
  { id: "h1", labelKey: "blockHandle.turnInto.h1" },
  { id: "h2", labelKey: "blockHandle.turnInto.h2" },
  { id: "h3", labelKey: "blockHandle.turnInto.h3" },
  { id: "bulletList", labelKey: "blockHandle.turnInto.bulletList" },
  { id: "orderedList", labelKey: "blockHandle.turnInto.orderedList" },
  { id: "taskList", labelKey: "blockHandle.turnInto.taskList" },
  { id: "blockquote", labelKey: "blockHandle.turnInto.blockquote" },
  { id: "codeBlock", labelKey: "blockHandle.turnInto.codeBlock" },
] as const;

const TURN_INTO_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
]);

const LAYOUTS = [
  { value: "two-column", labelKey: "blockHandle.layout.twoColumn" },
  { value: "sidebar-left", labelKey: "blockHandle.layout.sidebarLeft" },
  { value: "sidebar-right", labelKey: "blockHandle.layout.sidebarRight" },
];

function readActive(editor: Editor | null): ActiveBlock | null {
  if (!editor) return null;
  const pos = getActiveBlockPos(editor.state);
  if (pos == null) return null;
  const $pos = editor.state.doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node || !node.isBlock) return null;
  return { pos, nodeSize: node.nodeSize, typeName: node.type.name };
}

export function BlockHandleMenu({ editor }: { editor: Editor | null }) {
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [submenu, setSubmenu] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const prevPosRef = useRef<number | null>(null);
  const repositionRafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!isEditable) {
      setOpen(false);
      setSubmenu(null);
    }
  }, [isEditable]);

  // 同步清除扩展的激活块状态，避免高亮与手柄残留
  const clearActive = useCallback(() => {
    if (!editor) return;
    if (getActiveBlockPos(editor.state) != null) {
      editor.view.dispatch(
        editor.state.tr.setMeta(blockHandlesKey, { type: "setActive", pos: null }),
      );
    }
  }, [editor]);

  const closeAll = useCallback(() => {
    setOpen(false);
    setSubmenu(null);
    clearActive();
  }, [clearActive]);

  // 点击编辑器/弹窗以外的区域时关闭（与官方 drag-handle-menu 行为一致）。
  // 手柄区域除外：点手柄会切换激活块，由 transaction 流程重新定位。
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (popRef.current?.contains(target)) return;
      if (target.closest(".tk-block-handles")) return;
      closeAll();
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [open, editor, closeAll]);

  useLayoutEffect(() => {
    if (!open || !anchor || !popRef.current) return;
    const el = popRef.current;
    const w = el.offsetWidth;
    let nextLeft = Math.round(anchor.right - w - GAP);
    if (nextLeft < 8) nextLeft = 8;
    setLeft((prev) => (prev === nextLeft ? prev : nextLeft));

    // 视口边缘 clamp：菜单底部超出视口时上移贴边
    let nextTop = Math.round(anchor.top);
    const maxTop = window.innerHeight - el.offsetHeight - 8;
    if (nextTop > maxTop) nextTop = Math.max(8, maxTop);
    if (nextTop < 8) nextTop = 8;
    setTop((prev) => (prev === nextTop ? prev : nextTop));
  }, [open, anchor, submenu]);

  // 键盘导航：↑/↓ 移动焦点，→ 展开子菜单，← 收起，Esc 关闭（对齐官方菜单）
  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const items = popRef.current
      ? Array.from(
          popRef.current.querySelectorAll<HTMLElement>(".tk-block-popover-item"),
        )
      : [];
    if (e.key === "Escape") {
      e.preventDefault();
      closeAll();
      editor?.commands.focus();
      return;
    }
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next =
        e.key === "ArrowDown"
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
      items[next].focus();
    } else if (e.key === "ArrowRight") {
      const id = items[idx]?.getAttribute("data-submenu");
      if (id) {
        e.preventDefault();
        setSubmenu(id);
      }
    } else if (e.key === "ArrowLeft") {
      if (submenu) {
        e.preventDefault();
        setSubmenu(null);
      }
    }
  };

  const computeAnchor = useCallback(
    (pos: number): Anchor | null => {
      if (!editor) return null;
      const handleWrap = document.querySelector<HTMLElement>(".tk-block-handles:not(.is-hidden)");
      if (handleWrap) {
        const r = handleWrap.getBoundingClientRect();
        return { right: r.left, top: r.top };
      }
      const activeEl = editor.view.dom.querySelector<HTMLElement>(".tk-block-active");
      let el: HTMLElement | null = activeEl;
      if (!el) {
        const dom = editor.view.nodeDOM(pos);
        el = dom instanceof HTMLElement ? dom : null;
      }
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { right: rect.left, top: rect.top };
    },
    [editor],
  );

  useEffect(() => {
    if (!editor) return;

    const onTransaction = () => {
      const pos = getActiveBlockPos(editor.state);
      const prev = prevPosRef.current;
      prevPosRef.current = pos;

      if (pos != null && prev == null) {
        const node = editor.state.doc.resolve(pos).nodeAfter;
        if (!node || !node.isBlock) return;
        const place = () => {
          const next = computeAnchor(pos);
          if (next) {
            setLeft(0);
            setAnchor(next);
            setSubmenu(null);
            setOpen(true);
          }
        };
        requestAnimationFrame(place);
      } else if (pos == null && openRef.current) {
        setOpen(false);
        setSubmenu(null);
      } else if (pos != null && openRef.current) {
        const next = computeAnchor(pos);
        if (next) setAnchor(next);
      }
    };

    const onScrollResize = () => {
      if (!openRef.current) return;
      // rAF 合并高频 scroll/resize，避免每次事件都做 querySelector + 强制布局
      if (repositionRafRef.current != null) return;
      repositionRafRef.current = requestAnimationFrame(() => {
        repositionRafRef.current = null;
        if (!openRef.current) return;
        const pos = getActiveBlockPos(editor.state);
        if (pos == null) return;
        const next = computeAnchor(pos);
        if (next) setAnchor(next);
      });
    };

    editor.on("transaction", onTransaction);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);

    return () => {
      editor.off("transaction", onTransaction);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      if (repositionRafRef.current != null) {
        cancelAnimationFrame(repositionRafRef.current);
        repositionRafRef.current = null;
      }
    };
  }, [editor, computeAnchor]);

  if (!editor || !isEditable || !open) return null;

  const active = readActive(editor);
  if (!active) return null;

  const node = editor.state.doc.nodeAt(active.pos);
  if (!node) return null;

  const close = () => setOpen(false);

  const runAndClose = (fn: () => void) => () => {
    fn();
    close();
  };

  const updateAttributes = (attrs: Record<string, unknown>) => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateAttributes(active.typeName, attrs)
      .run();
  };

  const deleteNode = () => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .deleteRange({ from: active.pos, to: active.pos + active.nodeSize })
      .run();
  };

  const duplicate = () => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(active.pos + active.nodeSize, node.toJSON())
      .run();
  };

  const copyNode = () => {
    const tr = editor.state.tr.setSelection(
      NodeSelection.create(editor.state.doc, active.pos),
    );
    editor.view.dispatch(tr);
    document.execCommand("copy");
  };

  const cutNode = () => {
    const tr = editor.state.tr.setSelection(
      NodeSelection.create(editor.state.doc, active.pos),
    );
    editor.view.dispatch(tr);
    document.execCommand("cut");
  };

  const insertBelow = () => {
    const { paragraph } = editor.state.schema.nodes;
    const insertPos = active.pos + active.nodeSize;
    const tr = editor.state.tr;
    tr.insert(insertPos, paragraph.create());
    const slashPos = insertPos + 2;
    tr.insertText("/", insertPos + 1, insertPos + 1);
    tr.setSelection(TextSelection.create(tr.doc, slashPos));
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };

  const turnInto = (id: string) => {
    const chain = editor.chain().focus(undefined, { scrollIntoView: false });
    switch (id) {
      case "p":
        chain.setParagraph().run();
        break;
      case "h1":
      case "h2":
      case "h3":
        chain.toggleHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 }).run();
        break;
      case "bulletList":
        chain.toggleBulletList().run();
        break;
      case "orderedList":
        chain.toggleOrderedList().run();
        break;
      case "taskList":
        chain.toggleTaskList().run();
        break;
      case "blockquote":
        chain.toggleBlockquote().run();
        break;
      case "codeBlock":
        chain.toggleCodeBlock().run();
        break;
    }
  };

  const showTurnInto = TURN_INTO_TYPES.has(active.typeName);
  const isColumns = active.typeName === "columns";
  const isDetails = active.typeName === "details";

  const menu = (
    <div
      ref={popRef}
      className="tk-block-popover"
      contentEditable={false}
      style={{ position: "fixed", left, top, zIndex: 60 }}
      onKeyDown={onMenuKeyDown}
      onMouseDown={(e) => e.preventDefault()}
      onMouseOver={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".has-sub")) setSubmenu(null);
      }}
    >
      {showTurnInto && (
        <div
          className="tk-block-popover-item has-sub"
          data-submenu="turn"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSubmenu("turn");
            }
          }}
          onMouseEnter={() => setSubmenu("turn")}
        >
          <span className="tk-block-popover-icon"><IconTransform /></span>
          <span className="tk-block-popover-label">{t("blockHandle.turnInto")}</span>
          <span className="tk-block-popover-arrow"><IconChevronRight /></span>
          {submenu === "turn" && (
            <div className="tk-block-popover-sub">
              {TURN_INTO_TARGETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tk-block-popover-sub-item"
                  onClick={runAndClose(() => turnInto(item.id))}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isColumns && (
        <div
          className="tk-block-popover-item has-sub"
          data-submenu="layout"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSubmenu("layout");
            }
          }}
          onMouseEnter={() => setSubmenu("layout")}
        >
          <span className="tk-block-popover-icon"><IconColumns /></span>
          <span className="tk-block-popover-label">{t("blockHandle.layout")}</span>
          <span className="tk-block-popover-arrow"><IconChevronRight /></span>
          {submenu === "layout" && (
            <div className="tk-block-popover-sub" style={{ minWidth: 140 }}>
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  className={`tk-block-popover-sub-item${
                    (node.attrs.layout as string) === l.value ? " is-active" : ""
                  }`}
                  onClick={runAndClose(() => updateAttributes({ layout: l.value }))}
                >
                  {t(l.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isDetails && (
        <button
          type="button"
          className="tk-block-popover-item"
          onClick={runAndClose(() => updateAttributes({ open: !node.attrs.open }))}
        >
          <span className="tk-block-popover-icon"><IconChevronRight /></span>
          <span className="tk-block-popover-label">{node.attrs.open ? t("blockHandle.collapse") : t("blockHandle.expand")}</span>
        </button>
      )}

      <button type="button" className="tk-block-popover-item is-danger" onClick={runAndClose(deleteNode)}>
        <span className="tk-block-popover-icon"><IconTrash /></span>
        <span className="tk-block-popover-label">{t("blockHandle.delete")}</span>
      </button>
      <button type="button" className="tk-block-popover-item" onClick={runAndClose(duplicate)}>
        <span className="tk-block-popover-icon"><IconCopy /></span>
        <span className="tk-block-popover-label">{t("blockHandle.duplicate")}</span>
      </button>
      <button type="button" className="tk-block-popover-item" onClick={runAndClose(copyNode)}>
        <span className="tk-block-popover-icon"><IconCopy /></span>
        <span className="tk-block-popover-label">{t("blockHandle.copy")}</span>
      </button>
      <button type="button" className="tk-block-popover-item" onClick={runAndClose(cutNode)}>
        <span className="tk-block-popover-icon"><IconScissors /></span>
        <span className="tk-block-popover-label">{t("blockHandle.cut")}</span>
      </button>
      <button type="button" className="tk-block-popover-item" onClick={runAndClose(insertBelow)}>
        <span className="tk-block-popover-icon"><IconPlusBelow /></span>
        <span className="tk-block-popover-label">{t("blockHandle.insertBelow")}</span>
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
