"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  CellSelection,
  TableMap,
  selectedRect,
  columnIsHeader,
  rowIsHeader,
  isInTable,
  selectionCell,
} from "@tiptap/pm/tables";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tipkit/components";
import { useT, useEditorEditable, type Translate } from "@tipkit/core";

const PICKER_COLS = 8;
const PICKER_ROWS = 6;

function IconTableGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6.5h12M6 3v10" />
    </svg>
  );
}

function TbBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`tk-table-btn ${active ? "is-active" : ""}`}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TbDivider() {
  return <span className="tk-table-divider" />;
}

/* ─── 行列选择器（工具栏按钮） ─── */

export function TablePicker({
  editor,
  onInsert,
  t,
}: {
  editor: Editor;
  onInsert?: () => void;
  t?: Translate;
}) {
  const ctxT = useT();
  const tr = t ?? ctxT;
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ cols: number; rows: number }>({ cols: 0, rows: 0 });
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => force((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("update", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("update", refresh);
    };
  }, [editor]);

  const disabled = editor.isActive("table");

  const updatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popRef.current && !popRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const insert = (cols: number, rows: number) => {
    if (cols < 1 || rows < 1) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
    setHover({ cols: 0, rows: 0 });
    onInsert?.();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={btnRef}
            type="button"
            disabled={disabled}
            data-active={open || undefined}
            className="tk-toolbar-btn tk-inline-flex tk-items-center tk-justify-center tk-w-8 tk-h-8 tk-rounded"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (disabled) return;
              updatePosition();
              setOpen((v) => !v);
            }}
          >
            <IconTableGrid />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {disabled ? tr("table.cantInsertInTable") : tr("table.insertTable")}
        </TooltipContent>
      </Tooltip>
      {open && createPortal(
        <div
          ref={popRef}
          className="tk-table-picker"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translateX(-50%)",
          }}
          onMouseLeave={() => setHover({ cols: 0, rows: 0 })}
        >
          <div
            className="tk-table-picker-grid"
            style={{ gridTemplateColumns: `repeat(${PICKER_COLS}, 18px)` }}
          >
            {Array.from({ length: PICKER_ROWS }).map((_, r) =>
              Array.from({ length: PICKER_COLS }).map((_, c) => {
                const active = c < hover.cols && r < hover.rows;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onMouseEnter={() => setHover({ cols: c + 1, rows: r + 1 })}
                    onClick={() => insert(c + 1, r + 1)}
                    className={`tk-table-picker-cell ${active ? "is-active" : ""}`}
                  />
                );
              }),
            )}
          </div>
          <div className="tk-table-picker-label">
            {hover.cols > 0 ? `${hover.cols} × ${hover.rows}` : tr("table.dragToSelect")}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── 判断选区类型 ─── */

function isWholeTableSelection(state: Editor["state"]): boolean {
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) return false;
  const $anchor = sel.$anchorCell;
  for (let d = $anchor.depth; d > 0; d--) {
    if ($anchor.node(d).type.name !== "table") continue;
    const map = TableMap.get($anchor.node(d));
    const cells = (map as unknown as { map: number[] }).map;
    const start = $anchor.start(d);
    const first = start + cells[0];
    const last = start + cells[cells.length - 1];
    const a = sel.$anchorCell.pos;
    const h = sel.$headCell.pos;
    return (a === first && h === last) || (a === last && h === first);
  }
  return false;
}

function isMultiCellSelection(state: Editor["state"]): boolean {
  const sel = state.selection;
  return (
    sel instanceof CellSelection &&
    sel.$anchorCell.pos !== sel.$headCell.pos &&
    !isWholeTableSelection(state)
  );
}

function isTableSelection(state: Editor["state"]): boolean {
  return isWholeTableSelection(state) || isMultiCellSelection(state);
}

/* ─── 表格状态读取（表头/对齐） ─── */

function getTableRect(state: Editor["state"]) {
  if (!isInTable(state)) return null;
  try {
    return selectedRect(state);
  } catch {
    return null;
  }
}

function isHeaderRowActive(state: Editor["state"]): boolean {
  const rect = getTableRect(state);
  if (!rect) return false;
  return rowIsHeader(rect.map, rect.table, 0);
}

function isHeaderColumnActive(state: Editor["state"]): boolean {
  const rect = getTableRect(state);
  if (!rect) return false;
  return columnIsHeader(rect.map, rect.table, 0);
}

function getCellAlign(state: Editor["state"]): string | null {
  if (!isInTable(state)) return null;
  const $cell = selectionCell(state);
  return $cell?.nodeAfter?.attrs.align ?? null;
}

function resetColumnWidths(editor: Editor) {
  const { state } = editor;
  if (!isInTable(state)) return;
  const rect = selectedRect(state);
  const tr = state.tr;
  let changed = false;
  for (const pos of rect.map.map) {
    const cell = rect.table.nodeAt(pos);
    const cellPos = rect.tableStart + pos;
    if (cell && cell.attrs.colwidth) {
      tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: null });
      changed = true;
    }
  }
  if (changed) editor.view.dispatch(tr.scrollIntoView());
}

/* 订阅选区/文档更新，驱动按钮激活态重渲染。
 * 不能用 "transaction"：它会对每次事务（含 BubbleMenu 定位插件自身派发的事务）触发，
 * 造成 setTick → 重渲染 → 新事务 → setTick 的无限循环。 */
function useEditorTick(editor: Editor) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", onUpdate);
    editor.on("update", onUpdate);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("update", onUpdate);
    };
  }, [editor]);
}

/* ─── 单元格/整表工具栏（用 BubbleMenu 定位） ─── */

function IconMerge() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M9 3v10" strokeDasharray="2 2" />
    </svg>
  );
}

function IconSplit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M8 3v10" />
    </svg>
  );
}

function IconColBefore() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="8" height="10" rx="1" />
      <path d="M3 8h3M4.5 6.5L3 8l1.5 1.5" />
    </svg>
  );
}

function IconColAfter() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="8" height="10" rx="1" />
      <path d="M10 8h3M11.5 6.5L13 8l-1.5 1.5" />
    </svg>
  );
}

function IconRowBefore() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="11" height="7.5" rx="1" />
      <path d="M8 2v3M6.5 3.5L8 2l1.5 1.5" />
    </svg>
  );
}

function IconRowAfter() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="11" height="7.5" rx="1" />
      <path d="M8 11v3M6.5 12.5L8 14l1.5-1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9" />
    </svg>
  );
}

function IconHeader() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6.5h12" />
    </svg>
  );
}

function IconHeaderColumn() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M5.5 3v10" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />
    </svg>
  );
}

function IconAlignCenter() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2.5 4h11M4.5 8h7M3.5 12h9" />
    </svg>
  );
}

function IconAlignRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2.5 4h11M6.5 8h7M4.5 12h9" />
    </svg>
  );
}

function IconAutofit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8L5 5M2 8l3 3M14 8l-3-3m3 3l-3 3" />
      <path d="M5 8h6" />
    </svg>
  );
}

export function TableBubbleToolbar({ editor }: { editor: Editor }) {
  const t = useT();
  const whole = useRef(false);
  useEditorTick(editor);

  const align = getCellAlign(editor.state);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-table-bubble"
      shouldShow={({ editor: ed }) => {
        if (!ed.isEditable) return false;
        whole.current = isWholeTableSelection(ed.state);
        return isTableSelection(ed.state);
      }}
      options={{ placement: "top", offset: 8 }}
      updateDelay={50}
    >
      <div className="tk-table-toolbar">
        <TbBtn title={t("table.mergeCells")} onClick={() => editor.chain().focus().mergeCells().run()}>
          <IconMerge />
        </TbBtn>
        <TbBtn title={t("table.splitCells")} onClick={() => editor.chain().focus().splitCell().run()}>
          <IconSplit />
        </TbBtn>
        <TbDivider />
        <TbBtn title={t("table.insertColBefore")} onClick={() => editor.chain().focus().addColumnBefore().run()}>
          <IconColBefore />
        </TbBtn>
        <TbBtn title={t("table.insertColAfter")} onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <IconColAfter />
        </TbBtn>
        <TbBtn title={t("table.insertRowBefore")} onClick={() => editor.chain().focus().addRowBefore().run()}>
          <IconRowBefore />
        </TbBtn>
        <TbBtn title={t("table.insertRowAfter")} onClick={() => editor.chain().focus().addRowAfter().run()}>
          <IconRowAfter />
        </TbBtn>
        <TbDivider />
        <TbBtn
          title={t("table.toggleHeaderRow")}
          active={isHeaderRowActive(editor.state)}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        >
          <IconHeader />
        </TbBtn>
        <TbBtn
          title={t("table.toggleHeaderCol")}
          active={isHeaderColumnActive(editor.state)}
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
        >
          <IconHeaderColumn />
        </TbBtn>
        <TbDivider />
        <TbBtn
          title={t("table.alignLeft")}
          active={align === "left"}
          onClick={() => editor.chain().focus().setCellAttribute("align", "left").run()}
        >
          <IconAlignLeft />
        </TbBtn>
        <TbBtn
          title={t("table.alignCenter")}
          active={align === "center"}
          onClick={() => editor.chain().focus().setCellAttribute("align", "center").run()}
        >
          <IconAlignCenter />
        </TbBtn>
        <TbBtn
          title={t("table.alignRight")}
          active={align === "right"}
          onClick={() => editor.chain().focus().setCellAttribute("align", "right").run()}
        >
          <IconAlignRight />
        </TbBtn>
        <TbBtn title={t("table.resetWidth")} onClick={() => resetColumnWidths(editor)}>
          <IconAutofit />
        </TbBtn>
        <TbDivider />
        <TbBtn title={t("table.deleteTable")} onClick={() => editor.chain().focus().deleteTable().run()}>
          <IconTrash />
        </TbBtn>
      </div>
    </BubbleMenu>
  );
}

/* ─── 右键菜单（夹紧视口边界） ─── */

interface MenuItem {
  key: string;
  label: string;
  run: () => void;
  danger?: boolean;
  divider?: boolean;
}

export function TableContextMenu({ editor }: { editor: Editor }) {
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditable) {
      setPos(null);
      setAdjusted(null);
      return;
    }
    const el = editor.view.dom as HTMLElement;
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("td, th")) return;
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setAdjusted({ x: e.clientX, y: e.clientY });
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPos(null);
        setAdjusted(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
        setAdjusted(null);
      }
    };
    const onScroll = () => {
      setPos(null);
      setAdjusted(null);
    };
    el.addEventListener("contextmenu", onContext);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("contextmenu", onContext);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!pos || !ref.current) return;
    const menu = ref.current;
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    let { x, y } = pos;
    if (x + rect.width > window.innerWidth - margin) {
      x = window.innerWidth - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    setAdjusted({ x, y });
  }, [pos]);

  if (!pos || !adjusted) return null;

  const items: MenuItem[] = [
    { key: "merge", label: t("table.mergeCells"), run: () => editor.chain().focus().mergeCells().run() },
    { key: "split", label: t("table.splitCells"), run: () => editor.chain().focus().splitCell().run() },
    { key: "sep1", label: "", run: () => {}, divider: true },
    { key: "colBefore", label: t("table.insertColBefore"), run: () => editor.chain().focus().addColumnBefore().run() },
    { key: "colAfter", label: t("table.insertColAfter"), run: () => editor.chain().focus().addColumnAfter().run() },
    { key: "colDel", label: t("table.deleteCol"), run: () => editor.chain().focus().deleteColumn().run() },
    { key: "rowBefore", label: t("table.insertRowBefore"), run: () => editor.chain().focus().addRowBefore().run() },
    { key: "rowAfter", label: t("table.insertRowAfter"), run: () => editor.chain().focus().addRowAfter().run() },
    { key: "rowDel", label: t("table.deleteRow"), run: () => editor.chain().focus().deleteRow().run() },
    { key: "sep2", label: "", run: () => {}, divider: true },
    { key: "alignLeft", label: t("table.alignLeft"), run: () => editor.chain().focus().setCellAttribute("align", "left").run() },
    { key: "alignCenter", label: t("table.alignCenter"), run: () => editor.chain().focus().setCellAttribute("align", "center").run() },
    { key: "alignRight", label: t("table.alignRight"), run: () => editor.chain().focus().setCellAttribute("align", "right").run() },
    { key: "autofit", label: t("table.resetWidth"), run: () => resetColumnWidths(editor) },
    { key: "sep3", label: "", run: () => {}, divider: true },
    { key: "headerRow", label: t("table.toggleHeaderRow"), run: () => editor.chain().focus().toggleHeaderRow().run() },
    { key: "headerCol", label: t("table.toggleHeaderCol"), run: () => editor.chain().focus().toggleHeaderColumn().run() },
    { key: "headerCell", label: t("table.toggleHeaderCell"), run: () => editor.chain().focus().toggleHeaderCell().run() },
    { key: "sep4", label: "", run: () => {}, divider: true },
    { key: "del", label: t("table.deleteTable"), run: () => editor.chain().focus().deleteTable().run(), danger: true },
  ];

  const close = () => {
    setPos(null);
    setAdjusted(null);
  };

  return createPortal(
    <div
      ref={ref}
      className="tk-context-menu"
      style={{ position: "fixed", left: adjusted.x, top: adjusted.y, zIndex: 60 }}
    >
      {items.map((it) =>
        it.divider ? (
          <div key={it.key} className="tk-context-sep" />
        ) : (
          <button
            key={it.key}
            type="button"
            className={`tk-context-item ${it.danger ? "is-danger" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              it.run();
              close();
            }}
          >
            {it.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function TableControls({ editor }: { editor: Editor }) {
  return (
    <>
      <TableBubbleToolbar editor={editor} />
      <TableContextMenu editor={editor} />
    </>
  );
}
