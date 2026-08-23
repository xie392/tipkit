"use client";

import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

/* BlockHandles：Notion 风格块级双柄。
 * 手柄锚定到编辑器根（.ProseMirror）的直接子块元素：<p>/<hN>/<blockquote>/
 * <ul>/<ol>/.tableWrapper/<details>/NodeView wrapper 等，每个顶层块占一整行，
 * 最小块是 <p>。块内部结构变化不影响手柄位置。
 *
 * 点击拖拽按钮只激活块（淡蓝行高亮 + 工具栏），不改变 ProseMirror 选区、
 * 不选中文字；真正开始拖拽时才临时建立 NodeSelection 以生成拖拽数据。 */

const ACTIVE_CLASS = "tk-block-active";

function findFirstLineEl(blockEl: HTMLElement): HTMLElement | null {
  const summary = blockEl.querySelector(
    ":scope > summary, :scope > .tk-details > summary"
  );
  if (summary instanceof HTMLElement) return summary;

  const firstColumn = blockEl.querySelector(
    ":scope > .tk-column"
  ) as HTMLElement | null;
  if (firstColumn) {
    const firstChild = firstColumn.querySelector(
      ":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6"
    );
    if (firstChild instanceof HTMLElement) return firstChild;
    return firstColumn;
  }

  const firstInner = blockEl.querySelector(
    ":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6"
  );
  if (firstInner instanceof HTMLElement) return firstInner;

  if (blockEl.tagName === "UL" || blockEl.tagName === "OL") {
    const firstListItem = blockEl.querySelector(
      ":scope > li, :scope > [data-type='taskItem']"
    ) as HTMLElement | null;
    if (firstListItem) {
      const firstText = firstListItem.querySelector(
        "p, h1, h2, h3, h4, h5, h6"
      );
      if (firstText instanceof HTMLElement) return firstText;
      return firstListItem;
    }
  }

  return null;
}

function findBlockEl(start: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let el = start as HTMLElement | null;
  while (el && el !== root) {
    if (el.parentElement === root) return el;
    el = el.parentElement;
  }
  return null;
}

function getBlockNodePos(view: EditorView, el: HTMLElement): number | null {
  const pos = view.posAtDOM(el, 0);
  if (pos == null || pos < 0) return null;
  const $pos = view.state.doc.resolve(pos);
  // depth === 0: posAtDOM 返回的是顶层块之前的位置（atom NodeView，如
  // KaTeX/图片等），pos 本身就是块的起始位置，不能再调 before()（根节点无前驱位置，
  // 会抛 "There is no position before the top-level node"）。
  if ($pos.depth === 0) return pos;
  if ($pos.parentOffset === 0 && $pos.nodeAfter && $pos.nodeAfter.isBlock) {
    return pos - 1;
  }
  const start = $pos.before();
  return start < 0 ? null : start;
}

export const blockHandlesKey = new PluginKey("blockHandles");

export function getActiveBlockPos(state: EditorState): number | null {
  return (blockHandlesKey.getState(state) as { pos: number | null } | undefined)?.pos ?? null;
}

export const BlockHandles = Extension.create({
  name: "blockHandles",

  addProseMirrorPlugins() {
    let view: EditorView | null = null;
    let wrap: HTMLElement | null = null;
    let addBtn: HTMLButtonElement | null = null;
    let dragBtn: HTMLButtonElement | null = null;
    let hoverEl: HTMLElement | null = null;
    let activePos: number | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let dragSelection: NodeSelection | null = null;

    const setActive = (pos: number | null) => {
      if (!view) return;
      if (pos === activePos) return;
      activePos = pos;
      view.dispatch(
        view.state.tr.setMeta(blockHandlesKey, { type: "setActive", pos })
      );
    };

    const clearHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      wrap?.classList.remove("is-hidden");
    };

    const scheduleHide = () => {
      // 块处于激活态（块菜单可能正打开）时保持手柄可见，避免鼠标移入
      // portal 到 body 的弹层导致编辑器 mouseleave 而隐藏手柄。
      if (activePos != null) return;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => wrap?.classList.add("is-hidden"), 280);
    };

    const onAddClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!hoverEl || !view) return;
      const nodePos = getBlockNodePos(view, hoverEl);
      if (nodePos == null) return;
      const { paragraph } = view.state.schema.nodes;
      const tr = view.state.tr;
      tr.insert(nodePos, paragraph.create());
      tr.insertText("/", nodePos + 1, nodePos + 1);
      tr.setSelection(TextSelection.create(tr.doc, nodePos + 2));
      view.dispatch(tr.scrollIntoView());
      view.focus();
      wrap?.classList.add("is-hidden");
      setActive(null);
    };

    const onButtonMouseDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDragMouseDown = () => {
      if (!hoverEl || !view) return;
      const nodePos = getBlockNodePos(view, hoverEl);
      if (nodePos == null) return;
      setActive(nodePos);
      try {
        dragSelection = NodeSelection.create(view.state.doc, nodePos);
      } catch {
        dragSelection = null;
      }
    };

    const onDragStart = (e: DragEvent) => {
      if (!view || !dragSelection || !e.dataTransfer) return;
      const slice = dragSelection.content();
      const { dom, text } = view.serializeForClipboard(slice);
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.clearData();
      e.dataTransfer.setData("text/html", dom.innerHTML);
      e.dataTransfer.setData("text/plain", text);
      if (hoverEl) e.dataTransfer.setDragImage(hoverEl, 0, 0);
      view.dragging = { slice, move: true };
    };

    const onDragEnd = () => {
      dragSelection = null;
    };

    const positionUI = (blockEl: HTMLElement) => {
      if (!wrap || !view) return;
      const rect = blockEl.getBoundingClientRect();
      const wrapW = wrap.offsetWidth || 48;
      const wrapH = wrap.offsetHeight || 24;

      let left: number;
      const editorWrap = view.dom.closest(".tk-editor") as HTMLElement | null;
      if (editorWrap) {
        const editorRect = editorWrap.getBoundingClientRect();
        left = rect.left - wrapW - 8;
        const minLeft = editorRect.left + 8;
        if (left < minLeft) left = minLeft;
      } else {
        left = rect.left - wrapW - 8;
      }

      const firstLineEl = findFirstLineEl(blockEl);
      let top: number;
      if (firstLineEl) {
        const r = firstLineEl.getBoundingClientRect();
        const cs = getComputedStyle(firstLineEl);
        const padTop = parseFloat(cs.paddingTop) || 0;
        const lineH =
          parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6 || 24;
        top = r.top + padTop + lineH / 2 - wrapH / 2;
      } else {
        const cs = getComputedStyle(blockEl);
        const padTop = parseFloat(cs.paddingTop) || 0;
        const lineH =
          parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6 || 24;
        top = rect.top + padTop + lineH / 2 - wrapH / 2;
      }

      wrap.style.left = `${left}px`;
      wrap.style.top = `${top}px`;
      wrap.classList.remove("is-hidden");
    };

    const onScroll = () => {
      if (hoverEl && wrap && !wrap.classList.contains("is-hidden")) {
        positionUI(hoverEl);
      }
    };

    const createUI = () => {
      if (wrap) return;
      wrap = document.createElement("div");
      wrap.className = "tk-block-handles is-hidden";

      addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "tk-block-handle tk-block-handle-add";
      addBtn.setAttribute("aria-label", "在上方插入");
      addBtn.title = "在上方插入（/）";
      addBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

      dragBtn = document.createElement("button");
      dragBtn.type = "button";
      dragBtn.draggable = true;
      dragBtn.className = "tk-block-handle tk-block-handle-drag";
      dragBtn.setAttribute("aria-label", "拖拽移动");
      dragBtn.title = "拖拽移动";
      dragBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="4" cy="3.5" r="1.3"/><circle cx="12" cy="3.5" r="1.3"/><circle cx="4" cy="8" r="1.3"/><circle cx="12" cy="8" r="1.3"/><circle cx="4" cy="12.5" r="1.3"/><circle cx="12" cy="12.5" r="1.3"/></svg>';

      wrap.appendChild(addBtn);
      wrap.appendChild(dragBtn);

      wrap.style.position = "fixed";
      wrap.style.zIndex = "50";
      document.body.appendChild(wrap);

      addBtn.addEventListener("click", onAddClick);
      addBtn.addEventListener("mousedown", onButtonMouseDown);
      dragBtn.addEventListener("mousedown", onDragMouseDown);
      dragBtn.addEventListener("dragstart", onDragStart);
      dragBtn.addEventListener("dragend", onDragEnd);
      wrap.addEventListener("mouseenter", clearHide);
      wrap.addEventListener("mouseleave", scheduleHide);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll, true);
    };

    const destroyUI = () => {
      if (hideTimer) clearTimeout(hideTimer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll, true);
      addBtn?.removeEventListener("click", onAddClick);
      addBtn?.removeEventListener("mousedown", onButtonMouseDown);
      dragBtn?.removeEventListener("mousedown", onDragMouseDown);
      dragBtn?.removeEventListener("dragstart", onDragStart);
      dragBtn?.removeEventListener("dragend", onDragEnd);
      wrap?.removeEventListener("mouseenter", clearHide);
      wrap?.removeEventListener("mouseleave", scheduleHide);
      wrap?.remove();
      wrap = addBtn = dragBtn = null;
      hoverEl = null;
      activePos = null;
    };

    return [
      new Plugin({
        key: blockHandlesKey,
        state: {
          init: () => ({ pos: null as number | null }),
          apply(tr, value) {
            const meta = tr.getMeta(blockHandlesKey) as
              | { type: string; pos: number | null }
              | undefined;
            if (meta && meta.type === "setActive") {
              return { pos: meta.pos };
            }
            if (value.pos != null && (tr.docChanged || tr.selectionSet)) {
              return { pos: null };
            }
            return value;
          },
        },
        props: {
          decorations: (state) => {
            const { pos } = blockHandlesKey.getState(state) as { pos: number | null };
            if (pos == null) return DecorationSet.empty;
            const $pos = state.doc.resolve(pos);
            const node = $pos.nodeAfter;
            if (!node || !node.isBlock) return DecorationSet.empty;
            const deco = Decoration.node(pos, pos + node.nodeSize, {
              class: ACTIVE_CLASS,
            });
            return DecorationSet.create(state.doc, [deco]);
          },
          handleDOMEvents: {
            mousemove: (v, event) => {
              if (!v.editable || !wrap) return false;
              const blockEl = findBlockEl(event.target as EventTarget, v.dom as HTMLElement);
              if (!blockEl) {
                scheduleHide();
                hoverEl = null;
                return false;
              }
              hoverEl = blockEl;
              positionUI(blockEl);
              return false;
            },
            mouseleave: () => {
              scheduleHide();
              return false;
            },
            mousedown: (_v, event) => {
              const target = event.target as HTMLElement;
              if (wrap?.contains(target)) return false;
              if (activePos != null) {
                setActive(null);
              }
              wrap?.classList.add("is-hidden");
              return false;
            },
            keydown: (_v, event) => {
              if (event.key === "Escape") {
                if (activePos != null) setActive(null);
                return false;
              }
              if (event.altKey || event.ctrlKey || event.metaKey) {
                return false;
              }
              if (
                event.key.length === 1 ||
                event.key === "Backspace" ||
                event.key === "Delete" ||
                event.key === "Enter"
              ) {
                if (activePos != null) setActive(null);
              }
              wrap?.classList.add("is-hidden");
              return false;
            },
          },
        },
        view: (v) => {
          view = v;
          if (v.editable) createUI();
          return {
            update: (updatedView) => {
              view = updatedView;
            },
            destroy: () => destroyUI(),
          };
        },
      }),
    ];
  },
});

export default BlockHandles;
