"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

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
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="tk-table-btn"
    >
      {children}
    </button>
  );
}

function TbDivider() {
  return <span className="tk-table-divider" />;
}

/* ─── 行列选择器（工具栏按钮） ─── */

export function TablePicker({
  editor,
  onInsert,
}: {
  editor: Editor;
  onInsert?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ cols: number; rows: number }>({ cols: 0, rows: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
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
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        title="插入表格"
        data-active={open || undefined}
        className="tk-toolbar-btn inline-flex items-center justify-center w-8 h-8 rounded"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <IconTableGrid />
      </button>
      {open && (
        <div className="tk-table-picker" onMouseLeave={() => setHover({ cols: 0, rows: 0 })}>
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
            {hover.cols > 0 ? `${hover.cols} × ${hover.rows}` : "拖动选择行列"}
          </div>
        </div>
      )}
    </div>
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

export function TableBubbleToolbar({ editor }: { editor: Editor }) {
  const whole = useRef(false);

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
        <TbBtn title="合并单元格" onClick={() => editor.chain().focus().mergeCells().run()}>
          <IconMerge />
        </TbBtn>
        <TbBtn title="拆分单元格" onClick={() => editor.chain().focus().splitCell().run()}>
          <IconSplit />
        </TbBtn>
        <TbDivider />
        <TbBtn title="左侧插入列" onClick={() => editor.chain().focus().addColumnBefore().run()}>
          <IconColBefore />
        </TbBtn>
        <TbBtn title="右侧插入列" onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <IconColAfter />
        </TbBtn>
        <TbBtn title="上方插入行" onClick={() => editor.chain().focus().addRowBefore().run()}>
          <IconRowBefore />
        </TbBtn>
        <TbBtn title="下方插入行" onClick={() => editor.chain().focus().addRowAfter().run()}>
          <IconRowAfter />
        </TbBtn>
        <TbDivider />
        <TbBtn title="切换表头行" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
          <IconHeader />
        </TbBtn>
        <TbBtn title="删除表格" onClick={() => editor.chain().focus().deleteTable().run()}>
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
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editor.view.dom as HTMLElement;
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("td, th")) return;
      e.preventDefault();

      const menuW = 180;
      const menuH = 360;
      let x = e.clientX;
      let y = e.clientY;
      if (x + menuW > window.innerWidth - 8) x = window.innerWidth - menuW - 8;
      if (y + menuH > window.innerHeight - 8) y = window.innerHeight - menuH - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
      setOpen({ x, y });
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onScroll = () => setOpen(null);
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

  if (!open) return null;

  const c = editor.chain().focus();
  const items: MenuItem[] = [
    { key: "merge", label: "合并单元格", run: () => c.mergeCells().run() },
    { key: "split", label: "拆分单元格", run: () => c.splitCell().run() },
    { key: "sep1", label: "", run: () => {}, divider: true },
    { key: "colBefore", label: "左侧插入列", run: () => c.addColumnBefore().run() },
    { key: "colAfter", label: "右侧插入列", run: () => c.addColumnAfter().run() },
    { key: "colDel", label: "删除列", run: () => c.deleteColumn().run() },
    { key: "rowBefore", label: "上方插入行", run: () => c.addRowBefore().run() },
    { key: "rowAfter", label: "下方插入行", run: () => c.addRowAfter().run() },
    { key: "rowDel", label: "删除行", run: () => c.deleteRow().run() },
    { key: "sep2", label: "", run: () => {}, divider: true },
    { key: "header", label: "切换表头行", run: () => c.toggleHeaderRow().run() },
    { key: "del", label: "删除表格", run: () => c.deleteTable().run(), danger: true },
  ];

  const close = () => setOpen(null);

  return (
    <div
      ref={ref}
      className="tk-context-menu"
      style={{ position: "fixed", left: open.x, top: open.y, zIndex: 60 }}
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
    </div>
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
