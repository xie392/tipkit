"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tipkit/components";
import { useT, useEditorEditable } from "@tipkit/core";

/* 表格 hover 快捷控制（yiitap/Notion 风格）：
 * 控件不是浮层，而是经 widget 装饰挂进文档流的"边缘热区"——锚点插在每张
 * 表格正后方（零高度、随表格滚动），左缘热区悬停显示行加号（在指针所在行
 * 下方插行），顶缘热区显示列加号（在指针所在列右侧插列），左上角为全选
 * 把手。加号是热区的子元素，指针从单元格滑到热区再到加号全程连续 hover，
 * 不存在"离开判定"，不会半路消失；也没有 fixed 定位的滚动残留问题。 */

interface Box {
  left: number; // 表格相对锚点坐标
  top: number;
  width: number;
  height: number;
}

interface LocatedPlus {
  edge: "row" | "col";
  left: number; // 相对锚点坐标
  top: number;
  cellPos: number;
  insertAfter: boolean; // 加号挂在上边界/左边界时向前插入
  boundary: number; // 原始边界坐标（锚点系），供迟滞判定
  clientX: number; // 供布局变化后重定位
  clientY: number;
}

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

/** 行加号撞上块级拖拽把手（同占表格左侧带）时下移避开（锚点坐标系） */
function avoidBlockHandles(left: number, top: number, anchorRect: DOMRect): number {
  const handlesEl = document.querySelector(".tk-block-handles:not(.is-hidden)");
  const handlesRect = handlesEl?.getBoundingClientRect();
  if (!handlesRect) return top;
  const btnLeft = anchorRect.left + left;
  const btnRight = btnLeft + 18;
  if (btnRight > handlesRect.left && btnLeft < handlesRect.right && top + 18 > handlesRect.top && top < handlesRect.bottom) {
    return handlesRect.bottom - anchorRect.top + 2;
  }
  return top;
}

const pluginKey = new PluginKey("tableHoverAnchors");

/** 在每张表格正后方插入零高度锚点 widget；锚点元素复用，避免 React portal 反复重挂 */
function createAnchorPlugin(onAnchors: (anchors: HTMLElement[]) => void) {
  const pool: HTMLElement[] = [];
  let deco: DecorationSet = DecorationSet.empty;
  const build = (doc: import("@tiptap/pm/model").Node) => {
    const widgets: Decoration[] = [];
    let count = 0;
    doc.descendants((node, pos) => {
      if (node.type.name !== "table") return;
      const el = pool[count] ?? document.createElement("div");
      el.className = "tk-table-hover-anchor";
      pool[count] = el;
      widgets.push(
        Decoration.widget(pos + node.nodeSize, () => el, {
          side: 1,
          // 放行 mousemove：块级手柄依赖 PM 的 mousemove 定位；其余事件拦下，
          // 避免点击/拖拽被 PM 当作编辑器内容交互
          stopEvent: (event) => event.type !== "mousemove",
        }),
      );
      count += 1;
    });
    pool.length = count;
    deco = DecorationSet.create(doc, widgets);
    onAnchors(pool.slice());
  };
  return new Plugin({
    key: pluginKey,
    state: {
      init: (_, state) => {
        build(state.doc);
        return null;
      },
      apply: (_tr, value) => value,
    },
    props: {
      decorations: () => deco,
    },
    view: () => ({
      update: (view, prevState) => {
        if (!view.state.doc.eq(prevState.doc)) build(view.state.doc);
      },
      destroy: () => {
        pool.length = 0;
        deco = DecorationSet.empty;
      },
    }),
  });
}

export function TableHoverControls({ editor }: { editor: Editor }) {
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const [anchors, setAnchors] = useState<HTMLElement[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [hovers, setHovers] = useState<Record<number, LocatedPlus>>({});
  const hoverRef = useRef(hovers);
  hoverRef.current = hovers;
  const anchorsRef = useRef<HTMLElement[]>([]);
  anchorsRef.current = anchors;

  const locate = useCallback(
    (edge: "row" | "col", clientX: number, clientY: number, tableEl: HTMLElement, anchorEl: HTMLElement, forceAfter?: boolean): LocatedPlus | null => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const tableRect = tableEl.getBoundingClientRect();
      // 指针骑在表格边缘的热区上，投影到表格内部取所在行/列；
      // 探测点钳制在表格内（指针在表格外/两热区重叠区时也能取到单元格）
      const probe =
        edge === "row"
          ? {
              left: tableRect.left + 40,
              top: Math.min(Math.max(clientY, tableRect.top + 12), tableRect.bottom - 12),
            }
          : {
              left: Math.min(Math.max(clientX, tableRect.left + 24), tableRect.right - 12),
              top: tableRect.top + 40,
            };
      const coords = editor.view.posAtCoords(probe);
      if (!coords) return null;
      const $pos = editor.state.doc.resolve(coords.pos);
      let cellDepth = -1;
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name;
        if (name === "tableCell" || name === "tableHeader") {
          cellDepth = d;
          break;
        }
      }
      if (cellDepth < 0) return null;
      const cellPos = $pos.before(cellDepth);
      const cellDom = editor.view.nodeDOM(cellPos);
      const cellRect = cellDom instanceof HTMLElement ? cellDom.getBoundingClientRect() : null;
      if (!cellRect) return null;
      // 就近行/列边界锚定：加号中心正对插入点的分隔线，插入方向跟随边界
      if (edge === "row") {
        const insertAfter = forceAfter ?? clientY - cellRect.top > cellRect.bottom - clientY;
        const boundaryY = insertAfter ? cellRect.bottom : cellRect.top;
        return {
          edge,
          left: tableRect.left - anchorRect.left - 22,
          top: boundaryY - 9 - anchorRect.top,
          cellPos,
          insertAfter,
          boundary: boundaryY - anchorRect.top,
          clientX,
          clientY,
        };
      }
      const insertAfter = forceAfter ?? clientX - cellRect.left > cellRect.right - clientX;
      const boundaryX = insertAfter ? cellRect.right : cellRect.left;
      return {
        edge,
        left: boundaryX - 9 - anchorRect.left,
        top: tableRect.top - anchorRect.top - 22,
        cellPos,
        insertAfter,
        boundary: boundaryX - anchorRect.left,
        clientX,
        clientY,
      };
    },
    [editor],
  );

  const locateAt = useCallback(
    (index: number, clientX: number, clientY: number): LocatedPlus | null => {
      const anchorEl = anchorsRef.current[index];
      const tableEl = anchorEl?.previousElementSibling?.querySelector("table") as HTMLElement | null;
      if (!anchorEl || !tableEl) return null;
      return locate(hoverRef.current[index]?.edge ?? "row", clientX, clientY, tableEl, anchorEl);
    },
    [locate],
  );

  const onStrip = useCallback(
    (edge: "row" | "col", index: number) => (e: React.MouseEvent) => {
      const anchorEl = anchorsRef.current[index];
      const tableEl = anchorEl?.previousElementSibling?.querySelector("table") as HTMLElement | null;
      if (!anchorEl || !tableEl) return;
      // 迟滞：指针在上一条边界 ±12px 内时保持原插入方向，避免轻微晃动导致加号跳变
      const prev = hoverRef.current[index];
      let forceAfter: boolean | undefined;
      if (prev && prev.edge === edge) {
        const anchorRect = anchorEl.getBoundingClientRect();
        const pointer = edge === "row" ? e.clientY - anchorRect.top : e.clientX - anchorRect.left;
        if (Math.abs(pointer - prev.boundary) <= 12) forceAfter = prev.insertAfter;
      }
      const found = locate(edge, e.clientX, e.clientY, tableEl, anchorEl, forceAfter);
      if (!found) return;
      setHovers((prevMap) => ({ ...prevMap, [index]: found }));
    },
    [locate],
  );

  const onStripLeave = useCallback((index: number) => () => {
    setHovers((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const selectCell = useCallback(
    (pos: number) => {
      const { state, view } = editor;
      view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, pos, pos)));
    },
    [editor],
  );

  const addRow = useCallback(
    (cellPos: number, after: boolean) => {
      selectCell(cellPos);
      editor.chain().focus()[after ? "addRowAfter" : "addRowBefore"]().run();
    },
    [editor, selectCell],
  );

  const addColumn = useCallback(
    (cellPos: number, after: boolean) => {
      selectCell(cellPos);
      editor.chain().focus()[after ? "addColumnAfter" : "addColumnBefore"]().run();
    },
    [editor, selectCell],
  );

  const selectTable = useCallback(
    (cellPos: number) => {
      const { state, view } = editor;
      const $pos = state.doc.resolve(cellPos);
      let tableDepth = -1;
      for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === "table") {
          tableDepth = d;
          break;
        }
      }
      if (tableDepth < 0) return;
      const tablePos = $pos.before(tableDepth);
      const tableNode = state.doc.nodeAt(tablePos);
      if (!tableNode) return;
      const map = TableMap.get(tableNode);
      const tableStart = tablePos + 1;
      const anchor = tableStart + map.positionAt(0, 0, tableNode);
      const head = tableStart + map.positionAt(map.height - 1, map.width - 1, tableNode);
      view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, anchor, head)));
      editor.view.focus();
    },
    [editor],
  );

  // 注册锚点 widget 插件
  useEffect(() => {
    if (!isEditable) return;
    const plugin = createAnchorPlugin((list) => {
      setAnchors((prev) => (prev.length === list.length ? prev : list));
    });
    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(pluginKey);
      setAnchors([]);
      setHovers({});
    };
  }, [editor, isEditable]);

  // 计算每张表格相对锚点的几何（随文档流，无需监听 scroll）；布局变化时
  // 悬停中的加号按记录的指针位置重定位
  useEffect(() => {
    if (!isEditable || !anchors.length) return;
    const update = () => {
      setBoxes((prev) => {
        // 表格暂时找不到（PM 调整 widget DOM 时）时保留旧几何，避免 null 入态
        const nextBoxes = anchors.map((anchorEl, i) => {
          const tableEl = anchorEl.previousElementSibling?.querySelector("table");
          if (!(tableEl instanceof HTMLElement)) return prev[i] ?? null;
          const anchorRect = anchorEl.getBoundingClientRect();
          const r = tableEl.getBoundingClientRect();
          return {
            left: r.left - anchorRect.left,
            top: r.top - anchorRect.top,
            width: r.width,
            height: r.height,
          } as Box;
        });
        const same =
          prev.length === nextBoxes.length &&
          prev.every((b, i) => {
            const n = nextBoxes[i];
            if (b == null || n == null) return b == n;
            return (
              Math.abs(b.left - n.left) < 0.5 &&
              Math.abs(b.top - n.top) < 0.5 &&
              Math.abs(b.width - n.width) < 0.5 &&
              Math.abs(b.height - n.height) < 0.5
            );
          });
        return same ? prev : (nextBoxes as Box[]);
      });
      // 悬停中的加号跟随布局
      setHovers((prev) => {
        const entries = Object.entries(prev);
        if (!entries.length) return prev;
        let changed = false;
        const next: Record<number, LocatedPlus> = {};
        for (const [idx, h] of entries) {
          const i = Number(idx);
          const found = locateAt(i, h.clientX, h.clientY);
          if (found) {
            next[i] = found;
            if (Math.abs(found.left - h.left) > 0.5 || Math.abs(found.top - h.top) > 0.5) changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    update();
    const pm = editor.view.dom;
    const ro = new ResizeObserver(update);
    ro.observe(pm);
    anchors.forEach((a) => a.parentElement && ro.observe(a.parentElement));
    window.addEventListener("resize", update);
    editor.on("update", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      editor.off("update", update);
    };
  }, [editor, isEditable, anchors, locateAt]);

  if (!isEditable || !anchors.length) return null;

  return createPortal(
    <TooltipProvider delayDuration={300}>
      {anchors.map((anchorEl, index) => {
        const box = boxes[index];
        const hover = hovers[index];
        if (!box) return null;
        const rowStripActive = hover?.edge === "row";
        const colStripActive = hover?.edge === "col";
        return createPortal(
          <div className="tk-table-hover-controls" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            {/* 左缘热区：行加号（悬停行下方插入） */}
            <div
              className="tk-table-hover-strip is-row"
              onMouseEnter={onStrip("row", index)}
              onMouseMove={onStrip("row", index)}
              onMouseLeave={onStripLeave(index)}
            >
              {rowStripActive && hover && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="tk-table-hover-btn"
                      style={{ left: hover.left - box.left + 24, top: avoidBlockHandles(hover.left, hover.top, anchorEl.getBoundingClientRect()) - box.top + 28 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addRow(hover.cellPos, hover.insertAfter)}
                    >
                      <IconPlus />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t(hover.insertAfter ? "table.insertRowAfter" : "table.insertRowBefore")}
                  </TooltipContent>
                </Tooltip>
              )}
              {rowStripActive && hover && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="tk-table-hover-btn is-corner"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectTable(hover.cellPos)}
                    >
                      <IconSelectAll />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("table.selectTable")}</TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* 顶缘热区：列加号（悬停列右侧插入） */}
            <div
              className="tk-table-hover-strip is-col"
              onMouseEnter={onStrip("col", index)}
              onMouseMove={onStrip("col", index)}
              onMouseLeave={onStripLeave(index)}
            >
              {colStripActive && hover && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="tk-table-hover-btn"
                      style={{ left: hover.left - box.left + 28, top: hover.top - box.top + 24 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addColumn(hover.cellPos, hover.insertAfter)}
                    >
                      <IconPlus />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t(hover.insertAfter ? "table.insertColAfter" : "table.insertColBefore")}
                  </TooltipContent>
                </Tooltip>
              )}
              {colStripActive && hover && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="tk-table-hover-btn is-corner is-from-col"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectTable(hover.cellPos)}
                    >
                      <IconSelectAll />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("table.selectTable")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>,
          anchorEl,
        );
      })}
    </TooltipProvider>,
    anchors[0],
  );
}
