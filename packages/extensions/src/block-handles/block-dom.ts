import type { EditorView } from "@tiptap/pm/view";

/* BlockHandles 的 DOM 定位辅助：从事件目标找到顶层块元素、
 * 定位块首行（手柄垂直对齐）、以及块元素 → 文档位置换算。 */

export function findFirstLineEl(blockEl: HTMLElement): HTMLElement | null {
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

export function findBlockEl(start: EventTarget | null, root: HTMLElement): HTMLElement | null {
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

export function getBlockNodePos(view: EditorView, el: HTMLElement): number | null {
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
