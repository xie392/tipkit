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
  if (blockEl.matches(".tk-hr-wrap")) {
    const hr = blockEl.querySelector(":scope > hr");
    if (hr instanceof HTMLElement) return hr;
    return blockEl;
  }

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
    if (el.parentElement === root) {
      // 表格悬浮控件的锚点 widget 不是块：映射到它前面的表格块，
      // 否则悬停控件时块手柄会消失或锚定到表格下方的块
      if (el.classList.contains("tk-table-hover-anchor")) {
        const prev = el.previousElementSibling as HTMLElement | null;
        return prev ?? null;
      }
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function getBlockNodePos(view: EditorView, el: HTMLElement): number | null {
  const pos = view.posAtDOM(el, 0);
  if (pos == null || pos < 0) return null;
  const $pos = view.state.doc.resolve(pos);
  // depth === 0: posAtDOM 返回的是顶层块之前的位置（atom NodeView，如 KaTeX/图片等），
  // pos 本身就是块的起始位置；根节点无前驱位置，再调 before() 会抛错。
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
    // mousedown 时临时保存的信息：若随后触发 dragstart 则用于拖拽；若随后
    // 触发 click（未拖动）则用于激活菜单。两者互斥：一旦开始拖拽就不再弹菜单。
    let pendingPos: number | null = null;
    let pendingDragSelection: NodeSelection | null = null;
    let dragStarted = false;

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
      const targetNode = tr.doc.nodeAt(nodePos);
      if (targetNode && targetNode.type === paragraph && targetNode.content.size === 0) {
        const contentPos = nodePos + 1;
        tr.insertText("/", contentPos, contentPos);
        tr.setSelection(TextSelection.create(tr.doc, contentPos + 1));
      } else {
        tr.insert(nodePos, paragraph.create());
        tr.insertText("/", nodePos + 1, nodePos + 1);
        tr.setSelection(TextSelection.create(tr.doc, nodePos + 2));
      }
      view.dispatch(tr.scrollIntoView());
      view.focus();
      wrap?.classList.add("is-hidden");
      setActive(null);
    };

    const onButtonMouseDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // mousedown：仅记录目标块，不 dispatch 任何 transaction（避免重渲染打断拖拽）
    const onDragMouseDown = () => {
      if (!hoverEl || !view) return;
      const nodePos = getBlockNodePos(view, hoverEl);
      if (nodePos == null) return;
      pendingPos = nodePos;
      dragStarted = false;
      try {
        pendingDragSelection = NodeSelection.create(view.state.doc, nodePos);
      } catch {
        pendingDragSelection = null;
      }
    };

    // dragstart：真正开始拖拽，标记内部拖拽状态并设置 dataTransfer（用于给其他
    // 编辑器/应用识别内容，也设置 view.dragging 作为兜底）
    const onDragStart = (e: DragEvent) => {
      if (!view || !pendingDragSelection || !e.dataTransfer) return;
      dragStarted = true;
      const slice = pendingDragSelection.content();
      const { dom, text } = view.serializeForClipboard(slice);
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.dropEffect = "move";
      e.dataTransfer.clearData();
      e.dataTransfer.setData("text/html", dom.innerHTML);
      e.dataTransfer.setData("text/plain", text);
      // 使用自定义 MIME 标记这是 TipKit 内部块拖拽
      e.dataTransfer.setData("application/x-tipkit-block-drag", String(pendingPos));
      if (hoverEl) e.dataTransfer.setDragImage(hoverEl, 0, 0);
      view.dragging = { slice, move: true };
    };

    const onDragEnd = () => {
      if (view) view.dragging = null;
      pendingPos = null;
      pendingDragSelection = null;
      dragStarted = false;
    };

    // handleDrop：手动处理内部块拖拽移动。因为手柄按钮 portal 到 document.body，
    // 不在编辑器 DOM 内，ProseMirror 原生会把它当作外部粘贴（复制而非移动），
    // 所以我们自己识别 dataTransfer 上的标记并执行 move。
    const onDrop = (v: EditorView, event: DragEvent): boolean => {
      if (!dragStarted || pendingPos == null || !event.dataTransfer) return false;
      const isInternal = event.dataTransfer.types.includes("application/x-tipkit-block-drag");
      if (!isInternal) return false;
      event.preventDefault();
      const sourcePos = pendingPos;
      const coords = v.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!coords) return true;
      let dropPos = coords.pos;
      const tr = v.state.tr;
      const sourceNode = tr.doc.nodeAt(sourcePos);
      if (!sourceNode) return true;
      const sourceSize = sourceNode.nodeSize;
      // 调整目标位置：如果 drop 落在源块内部或紧贴源块边界，不做移动
      if (dropPos >= sourcePos && dropPos <= sourcePos + sourceSize) {
        onDragEnd();
        return true;
      }
      // 删除源块（先记录目标位置在删除后的偏移）
      let insertPos = dropPos;
      if (dropPos > sourcePos) insertPos -= sourceSize;
      const sourceSlice = tr.doc.slice(sourcePos, sourcePos + sourceSize);
      tr.delete(sourcePos, sourcePos + sourceSize);
      tr.insert(insertPos, sourceSlice.content);
      // 移动后把光标放到被移动块之后
      const afterPos = insertPos + sourceSize;
      tr.setSelection(TextSelection.create(tr.doc, Math.min(afterPos, tr.doc.content.size)));
      tr.setMeta(blockHandlesKey, { type: "setActive", pos: null });
      tr.scrollIntoView();
      v.dispatch(tr);
      v.focus();
      onDragEnd();
      return true;
    };

    // click：仅在没有触发拖拽时才激活菜单（mousedown → mouseup 未移动）
    const onDragClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragStarted) return;
      if (pendingPos != null) setActive(pendingPos);
      pendingPos = null;
      pendingDragSelection = null;
    };

    const positionUI = (blockEl: HTMLElement) => {
      if (!wrap || !view) return;
      const rect = blockEl.getBoundingClientRect();
      const wrapW = wrap.offsetWidth || 48;
      const wrapH = wrap.offsetHeight || 24;

      let left = rect.left - wrapW - 8;
      if (left < 8) left = 8;

      const firstLineEl = findFirstLineEl(blockEl);
      let top: number;
      if (firstLineEl) {
        const r = firstLineEl.getBoundingClientRect();
        if (firstLineEl.tagName === "HR") {
          top = r.top + r.height / 2 - wrapH / 2;
        } else {
          const cs = getComputedStyle(firstLineEl);
          const padTop = parseFloat(cs.paddingTop) || 0;
          const lineH =
            parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6 || 24;
          top = r.top + padTop + lineH / 2 - wrapH / 2;
        }
      } else {
        const cs = getComputedStyle(blockEl);
        const padTop = parseFloat(cs.paddingTop) || 0;
        const lineH =
          parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6 || 24;
        top = rect.top + padTop + lineH / 2 - wrapH / 2;
      }

      // 视口边缘 clamp：块滚出视口时手柄贴边而不消失
      if (top < 8) top = 8;
      const maxTop = window.innerHeight - wrapH - 8;
      if (top > maxTop) top = Math.max(8, maxTop);
      wrap.style.left = `${left}px`;
      wrap.style.top = `${top}px`;
      wrap.classList.remove("is-hidden");
    };

    // 激活块对应的 DOM 元素（菜单打开时手柄应锚定在它上面）
    const getActiveEl = (): HTMLElement | null => {
      if (activePos == null || !view) return null;
      const dom = view.nodeDOM(activePos);
      return dom instanceof HTMLElement ? dom : null;
    };

    // rAF 合并同一帧内的多次重定位（mousemove / scroll 触发频率高）。
    // force：hover 主动定位时强制显示（positionUI 会移除 is-hidden）；
    // 滚动等被动定位不唤醒已隐藏的手柄。
    let rafId: number | null = null;
    const schedulePosition = (force = false) => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!wrap) return;
        if (!force && wrap.classList.contains("is-hidden")) return;
        // 菜单打开时跟随激活块；否则跟随 hover 的块
        const el = getActiveEl() ?? hoverEl;
        if (el && el.isConnected) positionUI(el);
      });
    };

    const onScroll = () => {
      schedulePosition();
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
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="4" cy="3.5" r="1.3" fill="currentColor"/><circle cx="12" cy="3.5" r="1.3" fill="currentColor"/><circle cx="4" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="8" r="1.3" fill="currentColor"/><circle cx="4" cy="12.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12.5" r="1.3" fill="currentColor"/></svg>';

      wrap.appendChild(addBtn);
      wrap.appendChild(dragBtn);

      wrap.style.position = "fixed";
      wrap.style.zIndex = "50";
      document.body.appendChild(wrap);

      addBtn.addEventListener("click", onAddClick);
      addBtn.addEventListener("mousedown", onButtonMouseDown);
      dragBtn.addEventListener("mousedown", onDragMouseDown);
      dragBtn.addEventListener("click", onDragClick);
      dragBtn.addEventListener("dragstart", onDragStart);
      dragBtn.addEventListener("dragend", onDragEnd);
      wrap.addEventListener("mouseenter", clearHide);
      wrap.addEventListener("mouseleave", scheduleHide);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll, true);
    };

    const destroyUI = () => {
      if (hideTimer) clearTimeout(hideTimer);
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll, true);
      addBtn?.removeEventListener("click", onAddClick);
      addBtn?.removeEventListener("mousedown", onButtonMouseDown);
      dragBtn?.removeEventListener("mousedown", onDragMouseDown);
      dragBtn?.removeEventListener("click", onDragClick);
      dragBtn?.removeEventListener("dragstart", onDragStart);
      dragBtn?.removeEventListener("dragend", onDragEnd);
      wrap?.removeEventListener("mouseenter", clearHide);
      wrap?.removeEventListener("mouseleave", scheduleHide);
      wrap?.remove();
      wrap = addBtn = dragBtn = null;
      hoverEl = null;
      // 注：不再手动清理 activePos / pendingPos / pendingDragSelection / dragStarted。
      // 这些闭包变量随插件销毁后整个闭包被 GC，手动置 null 在 Turbopack +
      // React StrictMode 双重渲染场景下可能触发 TDZ 相关 ReferenceError。
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
          handleDrop: onDrop,
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
              // 菜单打开时手柄锁定在激活块上，不跟随 hover 移动，
              // 避免弹窗（锚定手柄位置）与按钮分离
              if (activePos != null) return false;
              const blockEl = findBlockEl(event.target as EventTarget, v.dom as HTMLElement);
              if (!blockEl) {
                scheduleHide();
                hoverEl = null;
                return false;
              }
              hoverEl = blockEl;
              schedulePosition(true);
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
                wrap?.classList.add("is-hidden");
              }
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
              // 菜单打开时不隐藏手柄，保持与弹窗对齐
              if (activePos == null) wrap?.classList.add("is-hidden");
              return false;
            },
          },
        },
        view: (v) => {
          view = v;
          if (v.editable) createUI();
          return {
            update: (updatedView, prevState) => {
              view = updatedView;
              const statePos = getActiveBlockPos(updatedView.state);
              if (statePos !== activePos) activePos = statePos;
              // 菜单打开期间手柄始终锚定激活块（doc/选区变化后的重对齐）
              if (statePos != null) {
                const dom = updatedView.nodeDOM(statePos);
                if (dom instanceof HTMLElement) positionUI(dom);
              }
              // 响应 editable 切换：只读时销毁手柄，可编辑时重建
              if (updatedView.editable && !wrap) {
                createUI();
              } else if (!updatedView.editable && wrap) {
                destroyUI();
                return;
              }
              if (
                updatedView.state.doc !== prevState.doc &&
                hoverEl &&
                !hoverEl.isConnected
              ) {
                hoverEl = null;
                wrap?.classList.add("is-hidden");
              }
            },
            destroy: () => destroyUI(),
          };
        },
      }),
    ];
  },
});

export default BlockHandles;
