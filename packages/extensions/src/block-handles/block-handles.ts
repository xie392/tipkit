"use client";

import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Selection,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/* BlockHandles：Notion 风格块级双柄。
 * 手柄锚定到编辑器根（.ProseMirror）的直接子块元素：<p>/<hN>/<blockquote>/
 * <ul>/<ol>/.tableWrapper/<details>/NodeView wrapper 等，每个顶层块占一整行，
 * 最小块是 <p>。块内部结构变化不影响手柄位置。 */

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
  if (pos == null || pos <= 0) return null;
  const $pos = view.state.doc.resolve(pos);
  if ($pos.parentOffset === 0 && $pos.nodeAfter && $pos.nodeAfter.isBlock) {
    return $pos.depth === 0 ? pos : pos - 1;
  }
  const start = $pos.before();
  return start < 0 ? null : start;
}

export const BlockHandles = Extension.create({
  name: "blockHandles",

  addProseMirrorPlugins() {
    const key = new PluginKey("blockHandles");

    let view: EditorView | null = null;
    let wrap: HTMLElement | null = null;
    let addBtn: HTMLButtonElement | null = null;
    let dragBtn: HTMLButtonElement | null = null;
    let activeEl: HTMLElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let activeSelection: Selection | null = null;

    const clearHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      wrap?.classList.remove("is-hidden");
    };

    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => wrap?.classList.add("is-hidden"), 280);
    };

    const onAddClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeEl || !view) return;
      const nodePos = getBlockNodePos(view, activeEl);
      if (nodePos == null) return;
      const { paragraph } = view.state.schema.nodes;
      const tr = view.state.tr;
      tr.insert(nodePos, paragraph.create());
      tr.insertText("/", nodePos + 1, nodePos + 1);
      tr.setSelection(TextSelection.create(tr.doc, nodePos + 2));
      view.dispatch(tr.scrollIntoView());
      view.focus();
      wrap?.classList.add("is-hidden");
    };

    const onButtonMouseDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDragMouseDown = (_e: Event) => {
      if (!activeEl || !view) return;
      const nodePos = getBlockNodePos(view, activeEl);
      if (nodePos == null) return;
      // 不 preventDefault：需要让浏览器原生 dragstart 触发（按钮 draggable=true）
      try {
        const sel = NodeSelection.create(view.state.doc, nodePos);
        view.dispatch(view.state.tr.setSelection(sel));
        view.focus();
        activeSelection = sel;
      } catch {
        activeSelection = null;
      }
    };

    const onDragStart = (e: DragEvent) => {
      if (!activeEl || !activeSelection || !view || !e.dataTransfer) return;
      const slice = activeSelection.content();
      const { dom, text } = view.serializeForClipboard(slice);
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.clearData();
      e.dataTransfer.setData("text/html", dom.innerHTML);
      e.dataTransfer.setData("text/plain", text);
      e.dataTransfer.setDragImage(activeEl, 0, 0);
      view.dragging = { slice, move: true };
    };

    const onDragEnd = () => {
      activeSelection = null;
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

    const positionAtSelection = (v: EditorView) => {
      const { selection } = v.state;
      if (!(selection instanceof NodeSelection)) return;
      const dom = v.nodeDOM(selection.from);
      if (dom instanceof HTMLElement) {
        const blockEl = findBlockEl(dom, v.dom as HTMLElement);
        if (blockEl) {
          activeEl = blockEl;
          positionUI(blockEl);
        }
      }
    };

    const onScroll = () => {
      if (activeEl && wrap && !wrap.classList.contains("is-hidden")) {
        positionUI(activeEl);
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
      activeEl = null;
    };

    return [
      new Plugin({
        key,
        view: (v) => {
          view = v;
          if (v.editable) createUI();
          return {
            update: (updatedView) => {
              view = updatedView;
              if (updatedView.editable && wrap) {
                positionAtSelection(updatedView);
              }
            },
            destroy: () => destroyUI(),
          };
        },
        props: {
          handleDOMEvents: {
            mousemove: (v, event) => {
              if (!v.editable || !wrap) return false;
              const blockEl = findBlockEl(event.target as EventTarget, v.dom as HTMLElement);
              if (!blockEl) {
                scheduleHide();
                activeEl = null;
                return false;
              }
              activeEl = blockEl;
              positionUI(blockEl);
              return false;
            },
            mouseleave: () => {
              scheduleHide();
              return false;
            },
            mousedown: () => {
              wrap?.classList.add("is-hidden");
              requestAnimationFrame(() => {
                if (view) positionAtSelection(view);
              });
              return false;
            },
            keydown: (_v, event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                return false;
              }
              wrap?.classList.add("is-hidden");
              return false;
            },
          },
        },
      }),
    ];
  },
});

export default BlockHandles;
