import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TableMap, cellAround, findTable } from "@tiptap/pm/tables";

/* 表格只读列宽拖拽：prosemirror-tables 的 columnResizing 在 !view.editable 时
 * 完全不激活（源码多处 if (!view.editable) return），只读文档无法调整列宽。
 * 本扩展仅在只读态激活：悬停列边显示拖拽光标，拖动实时更新该列所有
 * 单元格（含 colspan/rowspan 合并）的 colwidth 属性，走正常事务。 */

export const tableReadonlyResizeKey = new PluginKey<null>("tableReadonlyResize");

const HANDLE_PX = 6;
const MIN_COL_PX = 40;

interface BorderHit {
  tablePos: number;
  tableNode: PMNode;
  /** 拖动的列号（单元格最右列） */
  colIndex: number;
  /** colwidth 数组中对应的下标（考虑合并单元格） */
  spanIndex: number;
}

function hitBorder(view: EditorView, event: MouseEvent): BorderHit | null {
  const target = event.target as HTMLElement;
  const cellDom = target.closest("td, th");
  if (!cellDom || !view.dom.contains(cellDom)) return null;
  const domRect = cellDom.getBoundingClientRect();
  // 只在单元格右边缘 HANDLE_PX 内触发
  if (event.clientX - domRect.left < domRect.width - HANDLE_PX) return null;
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return null;
  const $cell = cellAround(view.state.doc.resolve(coords.pos));
  if (!$cell) return null;
  const table = findTable($cell);
  if (!table) return null;
  const map = TableMap.get(table.node as PMNode);
  let rect: { left: number; right: number };
  try {
    rect = map.findCell($cell.pos - (table.pos + 1));
  } catch {
    return null;
  }
  return {
    tablePos: table.pos,
    tableNode: table.node as PMNode,
    colIndex: rect.right - 1,
    spanIndex: rect.right - 1 - rect.left,
  };
}

/** 量取某列当前宽度：优先读 colwidth 属性，否则量首行 DOM */
function measureColumn(view: EditorView, tablePos: number, tableNode: PMNode, colIndex: number): number | null {
  const map = TableMap.get(tableNode);
  for (let row = 0; row < map.height; row += 1) {
    const cellOffset = map.map[row * map.width + colIndex];
    const cell = tableNode.nodeAt(cellOffset);
    if (!cell) continue;
    let left = colIndex;
    while (left > 0 && map.map[row * map.width + left - 1] === cellOffset) left -= 1;
    const widths = cell.attrs.colwidth as (number | null)[] | null;
    const w = widths ? widths[colIndex - left] : null;
    if (w != null) return w;
  }
  const domAt = view.domAtPos(tablePos + 1);
  const el = domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement;
  const firstRow = el?.querySelector("tr");
  const cells = firstRow ? Array.from(firstRow.querySelectorAll("td, th")) : [];
  const td = cells[colIndex] as HTMLElement | undefined;
  return td ? td.getBoundingClientRect().width : null;
}

/** 把新列宽应用到该列所有单元格（合并单元格按 spanIndex 定位） */
function applyWidth(view: EditorView, tablePos: number, tableNode: PMNode, colIndex: number, width: number) {
  const map = TableMap.get(tableNode);
  const tr = view.state.tr;
  const seen = new Set<number>();
  let changed = false;
  for (let row = 0; row < map.height; row += 1) {
    const cellOffset = map.map[row * map.width + colIndex];
    if (seen.has(cellOffset)) continue;
    seen.add(cellOffset);
    const cell = tableNode.nodeAt(cellOffset);
    if (!cell) continue;
    let left = colIndex;
    while (left > 0 && map.map[row * map.width + left - 1] === cellOffset) left -= 1;
    const spanIndex = colIndex - left;
    const colspan: number = cell.attrs.colspan ?? 1;
    const old = cell.attrs.colwidth as (number | null)[] | null;
    if (old && old[spanIndex] === width) continue;
    const next = old ? old.slice() : new Array(colspan).fill(null);
    next[spanIndex] = Math.round(width);
    tr.setNodeMarkup(tablePos + 1 + cellOffset, undefined, { colwidth: next });
    changed = true;
  }
  if (changed) view.dispatch(tr);
}

/** 拖拽中的模块级标记（mousemove 期间避免重复命中检测） */
let dragging = false;

export const TableReadonlyResize = Extension.create({
  name: "tableReadonlyResize",

  addProseMirrorPlugins() {
    return [
      new Plugin<null>({
        key: tableReadonlyResizeKey,
        props: {
          handleDOMEvents: {
            mousemove: (view: EditorView, event: MouseEvent) => {
              // 编辑态交给内置 columnResizing
              if (view.editable) return false;
              if (dragging) return true;
              const hit = hitBorder(view, event);
              view.dom.classList.toggle("resize-cursor", !!hit);
              return false;
            },
            mousedown: (view: EditorView, event: MouseEvent) => {
              if (view.editable) return false;
              const hit = hitBorder(view, event);
              if (!hit) return false;
              const baseWidth = measureColumn(view, hit.tablePos, hit.tableNode, hit.colIndex);
              if (baseWidth == null) return false;
              event.preventDefault();
              dragging = true;

              // 拖拽参考线（挂 body，屏幕坐标）
              const guide = document.createElement("div");
              guide.className = "tk-table-readonly-guide";
              document.body.appendChild(guide);
              const placeGuide = (x: number) => {
                const tableRect = view.domAtPos(hit.tablePos + 1);
                const el = tableRect.node instanceof HTMLElement ? tableRect.node : tableRect.node.parentElement;
                const rect = (el?.querySelector("table") ?? el)?.getBoundingClientRect();
                guide.style.display = "block";
                guide.style.left = `${x}px`;
                if (rect) {
                  guide.style.top = `${rect.top}px`;
                  guide.style.height = `${rect.height}px`;
                }
              };
              placeGuide(domRectRight(view, hit.tablePos, hit.colIndex));

              let lastWidth = baseWidth;
              const startX = event.clientX;
              const onMove = (e: MouseEvent) => {
                lastWidth = Math.max(MIN_COL_PX, baseWidth + e.clientX - startX);
                applyWidth(view, hit.tablePos, hit.tableNode, hit.colIndex, lastWidth);
                placeGuide(startX + lastWidth - baseWidth);
              };
              const onUp = () => {
                dragging = false;
                guide.remove();
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
              return true;
            },
            mouseleave: (view: EditorView) => {
              if (!view.editable) view.dom.classList.remove("resize-cursor");
              return false;
            },
          },
        },
      }),
    ];
  },
});

/** 某列右边缘的屏幕 x 坐标（用于参考线初始位置） */
function domRectRight(view: EditorView, tablePos: number, colIndex: number): number {
  const domAt = view.domAtPos(tablePos + 1);
  const el = domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement;
  const firstRow = el?.querySelector("tr");
  const cells = firstRow ? Array.from(firstRow.querySelectorAll("td, th")) : [];
  const td = cells[colIndex] as HTMLElement | undefined;
  return td ? td.getBoundingClientRect().right : 0;
}

export default TableReadonlyResize;
