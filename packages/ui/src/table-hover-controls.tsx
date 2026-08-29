"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { useEditorEditable } from "@tipkit/core";

/* 表格 hover 快捷控制（借鉴 yiitap 的悬浮把手，Notion 风格）：
 * - 悬停单元格时：该列顶边出现 "+"（下方加列）、该行左边出现 "+"（下方加行）
 * - 悬停表格时：左上角出现 "全选" 把手，点击选中整张表格
 * 定位基于 DOM rect（固定定位 + portal），滚动/离开表格即隐藏，鼠标再次移动时重算。 */

interface ControlsState {
  colPlus: { left: number; top: number };
  rowPlus: { left: number; top: number };
  corner: { left: number; top: number };
  cellPos: number;
  tablePos: number;
  tableStart: number;
  map: TableMap;
  tableNode: import("@tiptap/pm/model").Node;
}

const HIDE_GRACE_MS = 350;

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function IconSelectAll() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M5 8.2l2 2 4-4.2" />
    </svg>
  );
}

export function TableHoverControls({ editor }: { editor: Editor }) {
  const isEditable = useEditorEditable(editor);
  const [ctrl, setCtrl] = useState<ControlsState | null>(null);
  const rafRef = useRef(0);
  const hideTimerRef = useRef(0);
  const lastTableRectRef = useRef<DOMRect | null>(null);
  const ctrlRef = useRef<ControlsState | null>(null);
  ctrlRef.current = ctrl;

  /* 延迟隐藏：鼠标从单元格移向悬浮按钮（在表格外侧）的途中不闪退，
   * 按钮 onMouseEnter 会取消隐藏。 */
  const cancelHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
  }, []);
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setCtrl(null), HIDE_GRACE_MS);
  }, []);

  const compute = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      const cellDom = (target as HTMLElement | null)?.closest?.("td,th") as HTMLElement | null;
      const tableDom = (target as HTMLElement | null)?.closest?.("table") as HTMLElement | null;
      if (!cellDom || !tableDom) {
        // 不在表格上：若仍在最近表格的外扩区域内（移向悬浮按钮的途中），保持显示
        const rect = lastTableRectRef.current;
        const inGrace =
          rect &&
          clientX >= rect.left - 30 &&
          clientX <= rect.right + 30 &&
          clientY >= rect.top - 30 &&
          clientY <= rect.bottom + 30;
        if (!inGrace) scheduleHide();
        else cancelHide();
        return;
      }
      const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
      if (!coords) {
        setCtrl(null);
        return;
      }
      const $pos = editor.state.doc.resolve(coords.pos);
      let cellDepth = -1;
      let tableDepth = -1;
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name;
        if (tableDepth < 0 && name === "table") tableDepth = d;
        if (cellDepth < 0 && (name === "tableCell" || name === "tableHeader")) cellDepth = d;
      }
      if (cellDepth < 0 || tableDepth < 0) {
        setCtrl(null);
        return;
      }
      const tablePos = $pos.before(tableDepth);
      const tableNode = editor.state.doc.nodeAt(tablePos);
      if (!tableNode) {
        setCtrl(null);
        return;
      }
      const map = TableMap.get(tableNode);
      const tableStart = tablePos + 1;
      const cellRect = cellDom.getBoundingClientRect();
      const tableRect = tableDom.getBoundingClientRect();
      lastTableRectRef.current = tableRect;
      cancelHide();
      setCtrl({
        // 加号偏移到表格外侧（-24），全选把手再斜向远离（-24, -24），避免三者聚簇重叠
        colPlus: { left: cellRect.left + cellRect.width / 2, top: tableRect.top - 22 },
        rowPlus: { left: tableRect.left - 22, top: cellRect.top + cellRect.height / 2 },
        corner: { left: tableRect.left - 24, top: tableRect.top - 24 },
        cellPos: $pos.before(cellDepth),
        tablePos,
        tableStart,
        map,
        tableNode,
      });
    },
    [editor, cancelHide, scheduleHide]
  );

  useEffect(() => {
    if (!isEditable) {
      setCtrl(null);
      return;
    }
    const dom = editor.view.dom;
    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => compute(e.clientX, e.clientY, e.target));
    };
    const onMouseLeave = () => scheduleHide();
    const onScroll = () => scheduleHide();
    dom.addEventListener("mousemove", onMouseMove);
    dom.addEventListener("mouseleave", onMouseLeave);
    // 滚动时定位会失效，延迟隐藏，下次 mousemove 重算
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(hideTimerRef.current);
      dom.removeEventListener("mousemove", onMouseMove);
      dom.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [editor, isEditable, compute, scheduleHide]);

  const selectCell = useCallback(
    (pos: number) => {
      const { state, view } = editor;
      view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, pos, pos)));
    },
    [editor]
  );

  const addColumn = useCallback(() => {
    const cur = ctrlRef.current;
    if (!cur) return;
    selectCell(cur.cellPos);
    editor.chain().focus().addColumnAfter().run();
  }, [editor, selectCell]);

  const addRow = useCallback(() => {
    const cur = ctrlRef.current;
    if (!cur) return;
    selectCell(cur.cellPos);
    editor.chain().focus().addRowAfter().run();
  }, [editor, selectCell]);

  const selectTable = useCallback(() => {
    const cur = ctrlRef.current;
    if (!cur) return;
    const { state, view } = editor;
    const anchor = cur.tableStart + cur.map.positionAt(0, 0, cur.tableNode);
    const head = cur.tableStart + cur.map.positionAt(cur.map.height - 1, cur.map.width - 1, cur.tableNode);
    view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, anchor, head)));
    editor.view.focus();
  }, [editor]);

  if (!isEditable || !ctrl || typeof document === "undefined") return null;

  return createPortal(
    <div className="tk-table-hover-controls" contentEditable={false}>
      <button
        type="button"
        className="tk-table-hover-btn"
        style={{ left: ctrl.corner.left, top: ctrl.corner.top }}
        title="选中整个表格"
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        onClick={selectTable}
      >
        <IconSelectAll />
      </button>
      <button
        type="button"
        className="tk-table-hover-btn"
        style={{ left: ctrl.colPlus.left - 9, top: ctrl.colPlus.top }}
        title="在此列下方插入一列"
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        onClick={addColumn}
      >
        <IconPlus />
      </button>
      <button
        type="button"
        className="tk-table-hover-btn"
        style={{ left: ctrl.rowPlus.left, top: ctrl.rowPlus.top - 9 }}
        title="在此行下方插入一行"
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        onClick={addRow}
      >
        <IconPlus />
      </button>
    </div>,
    document.body
  );
}
