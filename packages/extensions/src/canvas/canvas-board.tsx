"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasShape, CanvasTool, CanvasView, Point, Bounds } from "./canvas-types";
import { createShapeId, screenToCanvas, pointInShape, boxIntersectsShape, getShapeBounds, getShapeCenter, rotatePoint, translateShape, DEFAULT_TEXT_COLOR, DEFAULT_FONT_SIZE, type CanvasFillStyle, type CanvasHead } from "./canvas-types";
import { toRoughHtml } from "./canvas-rough";
import {
  DRAW_TOOLS,
  clamp,
  type Corner,
  makeBaseShape,
  updateDraft,
  arrowHead,
  isValidDraft,
  computeNewBounds,
  resizeShapeByBox,
  reorderShapes,
  type ZDirection,
} from "./canvas-tools";
import { CanvasElementToolbar } from "./canvas-element-toolbar";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const WHEEL_STEP = 1.1;
const SNAP_GRID = 8;

const isRealColor = (c?: string): c is string => !!c && c !== "none" && c !== "transparent";

type Mode =
  | { kind: "idle" }
  | { kind: "pan"; startView: CanvasView; startX: number; startY: number }
  | { kind: "move"; startCanvas: Point; startShapes: CanvasShape[]; ids: Set<string> }
  | { kind: "resize"; corner: Corner; ids: Set<string>; startShapes: CanvasShape[] }
  | { kind: "rotate"; startCanvas: Point; ids: Set<string>; startShapes: CanvasShape[] }
  | { kind: "draw" }
  | { kind: "box"; startCanvas: Point };

interface Props {
  shapes: CanvasShape[];
  width: number;
  height: number;
  tool: CanvasTool;
  editable: boolean;
  view: CanvasView;
  /** 是否手绘渲染（rough） */
  rough: boolean;
  /** 是否网格吸附 */
  snap: boolean;
  onViewChange: (v: CanvasView) => void;
  onChange: (shapes: CanvasShape[]) => void;
}

export function CanvasBoard({ shapes, width, height, tool, editable, view, rough, snap, onViewChange, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridIdRef = useRef(`tk-canvas-grid-${Math.random().toString(36).slice(2, 8)}`);

  const [working, setWorking] = useState<CanvasShape[]>(shapes);
  const workingRef = useRef(working);
  const [draft, setDraft] = useState<CanvasShape | null>(null);
  const [boxSel, setBoxSel] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedRef = useRef(selected);

  const setSelectedBoth = useCallback((s: Set<string>) => {
    selectedRef.current = s;
    setSelected(s);
  }, []);
  const [textDraft, setTextDraft] = useState<{ canvas: Point; value: string } | null>(null);

  const modeRef = useRef<Mode>({ kind: "idle" });
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);

  // 全局快捷键：按住空格=临时抓手平移；按住 Shift=绘制时约束比例/角度
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = true;
      if (e.key === "Shift") shiftRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
      if (e.key === "Shift") shiftRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const setWorkingBoth = useCallback((next: CanvasShape[]) => {
    workingRef.current = next;
    setWorking(next);
  }, []);

  const commit = useCallback(
    (next: CanvasShape[]) => {
      setWorkingBoth(next);
      onChange(next);
    },
    [onChange, setWorkingBoth],
  );

  // 撤销/重做等外部 shapes 变化时，空闲态下同步本地 working
  useEffect(() => {
    if (modeRef.current.kind === "idle") {
      workingRef.current = shapes;
      setWorking(shapes);
    }
  }, [shapes]);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current!.getBoundingClientRect();
      const p = screenToCanvas(clientX - rect.left, clientY - rect.top, view);
      if (snap) return { x: Math.round(p.x / SNAP_GRID) * SNAP_GRID, y: Math.round(p.y / SNAP_GRID) * SNAP_GRID };
      return p;
    },
    [view, snap],
  );

  // 滚轮缩放：用原生非 passive 监听，确保 preventDefault 生效，阻止页面/外层滚动条跟着滚动
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelHandlerRef.current = (e: WheelEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    const newZoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = newZoom / view.zoom;
    onViewChange({ x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k, zoom: newZoom });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandlerRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).focus();
      const p = getCanvasPoint(e.clientX, e.clientY);

      // 按住空格 = 临时抓手平移（覆盖所有工具）
      if (spaceRef.current) {
        modeRef.current = { kind: "pan", startView: view, startX: e.clientX, startY: e.clientY };
        return;
      }

      if (tool === "select") {
        const target = e.target as Element;
        // 命中旋转手柄 -> 进入 rotate
        if (target.classList && target.classList.contains("tk-canvas-rotate-handle")) {
          modeRef.current = { kind: "rotate", startCanvas: p, ids: new Set(selectedRef.current), startShapes: workingRef.current };
          return;
        }
        // 命中选中元素的缩放手柄 -> 进入 resize
        if (target.classList && target.classList.contains("tk-canvas-resize-handle")) {
          const corner = target.getAttribute("data-corner") as Corner;
          modeRef.current = { kind: "resize", corner, ids: new Set(selectedRef.current), startShapes: workingRef.current };
          return;
        }
      }

      if (tool === "hand") {
        modeRef.current = { kind: "pan", startView: view, startX: e.clientX, startY: e.clientY };
        return;
      }
      if (tool === "box") {
        modeRef.current = { kind: "box", startCanvas: p };
        setBoxSel({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });
        return;
      }
      if (tool === "text") {
        setTextDraft({ canvas: p, value: "" });
        return;
      }
      if (tool === "select") {
        let hit: CanvasShape | null = null;
        for (let i = workingRef.current.length - 1; i >= 0; i--) {
          if (pointInShape(p.x, p.y, workingRef.current[i])) {
            hit = workingRef.current[i];
            break;
          }
        }
        if (hit) {
          const ids = selectedRef.current.has(hit.id) ? new Set(selectedRef.current) : new Set([hit.id]);
          setSelectedBoth(ids);
          modeRef.current = { kind: "move", startCanvas: p, startShapes: workingRef.current, ids };
        } else {
          setSelectedBoth(new Set());
          modeRef.current = { kind: "box", startCanvas: p };
          setBoxSel({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });
        }
        return;
      }
      if (DRAW_TOOLS.includes(tool)) {
        setDraft(makeBaseShape(tool, p));
        modeRef.current = { kind: "draw" };
      }
    },
    [editable, tool, getCanvasPoint, view],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const m = modeRef.current;
      if (m.kind === "pan") {
        e.preventDefault();
        onViewChange({
          ...m.startView,
          x: m.startView.x + (e.clientX - m.startX),
          y: m.startView.y + (e.clientY - m.startY),
        });
      } else if (m.kind === "move") {
        const p = getCanvasPoint(e.clientX, e.clientY);
        const dx = p.x - m.startCanvas.x;
        const dy = p.y - m.startCanvas.y;
        setWorkingBoth(m.startShapes.map((s) => (m.ids.has(s.id) ? translateShape(s, dx, dy) : s)));
      } else if (m.kind === "resize") {
        const p = getCanvasPoint(e.clientX, e.clientY);
        setWorkingBoth(
          m.startShapes.map((s) => {
            if (!m.ids.has(s.id)) return s;
            const orig = getShapeBounds(s);
            // 旋转元素：把指针转到局部系再缩放，保持 rotation 不变
            const rot = s.rotation || 0;
            const lp = rot ? rotatePoint(p.x, p.y, -rot, getShapeCenter(s).x, getShapeCenter(s).y) : p;
            return resizeShapeByBox(s, orig, computeNewBounds(orig, m.corner, lp));
          }),
        );
      } else if (m.kind === "rotate") {
        const p = getCanvasPoint(e.clientX, e.clientY);
        setWorkingBoth(
          m.startShapes.map((s) => {
            if (!m.ids.has(s.id)) return s;
            const c = getShapeCenter(s);
            const a0 = Math.atan2(m.startCanvas.y - c.y, m.startCanvas.x - c.x);
            const a1 = Math.atan2(p.y - c.y, p.x - c.x);
            const startRot = s.rotation || 0;
            return { ...s, rotation: startRot + ((a1 - a0) * 180) / Math.PI };
          }),
        );
      } else if (m.kind === "box") {
        const p = getCanvasPoint(e.clientX, e.clientY);
        setBoxSel({
          minX: Math.min(m.startCanvas.x, p.x),
          minY: Math.min(m.startCanvas.y, p.y),
          maxX: Math.max(m.startCanvas.x, p.x),
          maxY: Math.max(m.startCanvas.y, p.y),
        });
      } else if (m.kind === "draw" && draft) {
        const p = getCanvasPoint(e.clientX, e.clientY);
        setDraft((d) => (d ? updateDraft(d, p, shiftRef.current) : d));
      }
    },
    [getCanvasPoint, setWorkingBoth, draft, onViewChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const m = modeRef.current;
      if (m.kind === "move" || m.kind === "resize" || m.kind === "rotate") {
        commit(workingRef.current);
      } else if (m.kind === "box" && boxSel) {
        const sel = workingRef.current.filter((s) => boxIntersectsShape(boxSel, s)).map((s) => s.id);
        setSelectedBoth(new Set(sel));
        setBoxSel(null);
      } else if (m.kind === "draw" && draft) {
        if (isValidDraft(draft)) commit([...workingRef.current, draft]);
        setDraft(null);
      }
      modeRef.current = { kind: "idle" };
    },
    [commit, boxSel, draft],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editable) return;
      if (textDraft) {
        if (e.key === "Enter") {
          e.preventDefault();
          const value = textDraft.value;
          setTextDraft(null);
          if (value.trim()) {
            const shape: CanvasShape = {
              id: createShapeId(),
              type: "text",
              x: textDraft.canvas.x,
              y: textDraft.canvas.y,
              text: value,
              fontSize: DEFAULT_FONT_SIZE,
              color: DEFAULT_TEXT_COLOR,
            };
            commit([...workingRef.current, shape]);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setTextDraft(null);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0) {
          e.preventDefault();
          const next = workingRef.current.filter((s) => !selected.has(s.id));
          setSelectedBoth(new Set());
          commit(next);
        }
      } else if (e.key === "Escape") {
        setSelectedBoth(new Set());
      }
    },
    [editable, textDraft, commit, selected],
  );

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextDraft((td) => (td ? { ...td, value: e.target.value } : td));
  }, []);

  // 对选中元素做样式变更
  const mutateSelected = useCallback(
    (fn: (s: CanvasShape) => CanvasShape) => {
      const next = workingRef.current.map((s) => (selectedRef.current.has(s.id) ? fn(s) : s));
      commit(next);
    },
    [commit],
  );

  const toggleDash = useCallback(() => {
    mutateSelected((s) => ({ ...s, dash: !s.dash }));
  }, [mutateSelected]);

  const setHead = useCallback(
    (head: CanvasHead) => {
      mutateSelected((s) => (s.type === "line" || s.type === "arrow" ? { ...s, head } : s));
    },
    [mutateSelected],
  );

  const setFill = useCallback(
    (fillStyle: CanvasFillStyle) => {
      mutateSelected((s) => (s.type === "rect" || s.type === "circle" || s.type === "path" ? { ...s, fillStyle } : s));
    },
    [mutateSelected],
  );

  const zMove = useCallback(
    (dir: ZDirection) => {
      const next = reorderShapes(workingRef.current, selectedRef.current, dir);
      setSelectedBoth(new Set());
      commit(next);
    },
    [commit, setSelectedBoth],
  );

  const selectedShapes = working.filter((s) => selected.has(s.id));

  const renderCleanShape = (s: CanvasShape): React.ReactNode => {
    const dashArr = s.dash ? "8 6" : undefined;
    // 清晰模式下 fill：solid/hachure 都用填充色实心（hachure 主要服务于手绘主题）
    const fillFor = (stroke: string, fill: string): string => (s.fillStyle === "none" || !s.fillStyle ? "none" : isRealColor(fill) ? fill : stroke);
    switch (s.type) {
      case "rect": {
        const stroke = s.stroke;
        return <rect className="tk-canvas-shape" x={s.x} y={s.y} width={s.w} height={s.h} fill={fillFor(stroke, s.fill)} stroke={stroke} strokeWidth={s.strokeWidth} strokeDasharray={dashArr} />;
      }
      case "circle": {
        const stroke = s.stroke;
        return <circle className="tk-canvas-shape" cx={s.x} cy={s.y} r={s.r} fill={fillFor(stroke, s.fill)} stroke={stroke} strokeWidth={s.strokeWidth} strokeDasharray={dashArr} />;
      }
      case "line": {
        const stroke = s.stroke;
        const line = <line className="tk-canvas-shape" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={s.strokeWidth} strokeDasharray={dashArr} />;
        const head = s.head || "none";
        if (head === "arrow")
          return (
            <g className="tk-canvas-shape">
              {line}
              <polygon points={arrowHead(s.x1, s.y1, s.x2, s.y2)} fill={stroke} />
            </g>
          );
        if (head === "dot") {
          const r = Math.max(s.strokeWidth, 4);
          return (
            <g className="tk-canvas-shape">
              {line}
              <circle cx={s.x2} cy={s.y2} r={r} fill={stroke} />
            </g>
          );
        }
        return line;
      }
      case "arrow": {
        const stroke = s.stroke;
        return (
          <g className="tk-canvas-shape">
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={s.strokeWidth} strokeDasharray={dashArr} />
            <polygon points={arrowHead(s.x1, s.y1, s.x2, s.y2)} fill={stroke} />
          </g>
        );
      }
      case "path": {
        const d =
          s.points.length > 1
            ? `M ${s.points[0].x} ${s.points[0].y} L ${s.points
                .slice(1)
                .map((p) => `${p.x} ${p.y}`)
                .join(" L ")}`
            : "";
        return <path className="tk-canvas-shape" d={d} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={dashArr} strokeLinecap="round" strokeLinejoin="round" />;
      }
      case "text":
        return (
          <text className="tk-canvas-shape" x={s.x} y={s.y} fontSize={s.fontSize} fill={s.color} style={{ userSelect: "none" }}>
            {s.text}
          </text>
        );
      case "image":
        return <image className="tk-canvas-shape" x={s.x} y={s.y} width={s.w} height={s.h} href={s.src} preserveAspectRatio="xMidYMid meet" />;
    }
  };

  const renderShape = (s: CanvasShape) => {
    const rot = s.rotation || 0;
    const c = getShapeCenter(s);
    const transform = rot ? `rotate(${rot} ${c.x} ${c.y})` : undefined;
    // 手绘模式：rect/circle/line/arrow/path 用手绘渲染，text/image 走清晰
    if (rough && s.type !== "text" && s.type !== "image") {
      const html = toRoughHtml(s);
      if (html) return <g key={s.id} transform={transform} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    const inner = renderCleanShape(s);
    return (
      <g key={s.id} transform={transform}>
        {inner}
      </g>
    );
  };

  const renderSelection = () =>
    working
      .filter((s) => selected.has(s.id))
      .map((s) => {
        const b = getShapeBounds(s);
        const pad = 4;
        const rect = (
          <rect
            className="tk-canvas-selection"
            x={b.minX - pad}
            y={b.minY - pad}
            width={b.maxX - b.minX + pad * 2}
            height={b.maxY - b.minY + pad * 2}
          />
        );
        const rot = s.rotation || 0;
        if (rot) {
          const c = getShapeCenter(s);
          return (
            <g key={`sel-${s.id}`} transform={`rotate(${rot} ${c.x} ${c.y})`}>
              {rect}
            </g>
          );
        }
        return <g key={`sel-${s.id}`}>{rect}</g>;
      });

  // 缩放手柄 + 旋转手柄（屏幕坐标系，尺寸恒定不随缩放变化；随元素旋转）
  const renderResizeHandles = () => {
    if (!editable || tool !== "select" || selected.size === 0) return null;
    const HS = 8;
    return working
      .filter((s) => selected.has(s.id))
      .map((s) => {
        const b = getShapeBounds(s);
        const c = getShapeCenter(s);
        const rot = s.rotation || 0;
        // 局部系四角 + 顶边中点，旋转到屏幕坐标系
        const local = [
          { c: "tl" as Corner, x: b.minX, y: b.minY },
          { c: "tr" as Corner, x: b.maxX, y: b.minY },
          { c: "bl" as Corner, x: b.minX, y: b.maxY },
          { c: "br" as Corner, x: b.maxX, y: b.maxY },
          { c: "rt" as any, x: c.x, y: b.minY }, // 旋转手柄位置（顶边中点）
        ];
        return local.map(({ c: corner, x, y }) => {
          const p = rot ? rotatePoint(x, y, rot, c.x, c.y) : { x, y };
          const sx = view.x + p.x * view.zoom;
          const sy = view.y + p.y * view.zoom;
          if (corner === "rt") {
            return (
              <g key={`rh-${s.id}-rt`}>
                <line className="tk-canvas-rotate-line" x1={view.x + c.x * view.zoom} y1={view.y + c.y * view.zoom} x2={sx} y2={sy} />
                <circle
                  className="tk-canvas-rotate-handle"
                  data-corner="rt"
                  cx={sx}
                  cy={sy}
                  r={HS / 2}
                />
              </g>
            );
          }
          return (
            <rect
              key={`rh-${s.id}-${corner}`}
              className="tk-canvas-resize-handle"
              data-corner={corner}
              x={sx - HS / 2}
              y={sy - HS / 2}
              width={HS}
              height={HS}
            />
          );
        });
      });
  };

  const textScreen = textDraft
    ? { left: view.x + textDraft.canvas.x * view.zoom, top: view.y + textDraft.canvas.y * view.zoom }
    : null;

  return (
    <div
      ref={containerRef}
      className={`tk-canvas-board${editable ? " is-editable" : ""}`}
      style={{ width, height }}
      contentEditable={false}
      tabIndex={editable ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        modeRef.current = { kind: "idle" };
        setDraft(null);
        setBoxSel(null);
      }}
      onKeyDown={handleKeyDown}
    >
      <svg className="tk-canvas-svg" width={width} height={height}>
        <defs>
          <pattern id={gridIdRef.current} width={20} height={20} patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" className="tk-canvas-grid-line" />
          </pattern>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
          <rect className="tk-canvas-grid" x={-100000} y={-100000} width={200000} height={200000} fill={`url(#${gridIdRef.current})`} />
          {working.map(renderShape)}
          {draft && renderShape(draft)}
          {renderSelection()}
        </g>
        {boxSel && (
          <rect
            className="tk-canvas-boxsel"
            x={view.x + boxSel.minX * view.zoom}
            y={view.y + boxSel.minY * view.zoom}
            width={(boxSel.maxX - boxSel.minX) * view.zoom}
            height={(boxSel.maxY - boxSel.minY) * view.zoom}
          />
        )}
        {renderResizeHandles()}
      </svg>

      {editable && selected.size > 0 && (
        <CanvasElementToolbar
          shapes={selectedShapes}
          dashActive={selectedShapes.some((s) => s.dash)}
          onToggleDash={toggleDash}
          onSetHead={setHead}
          onSetFill={setFill}
          onZ={zMove}
        />
      )}

      {textScreen && (
        <input
          className="tk-canvas-text-input"
          style={{ left: textScreen.left, top: textScreen.top - DEFAULT_FONT_SIZE }}
          autoFocus
          value={textDraft!.value}
          onChange={handleTextChange}
          onBlur={() => {
            if (textDraft) {
              const value = textDraft.value;
              setTextDraft(null);
              if (value.trim()) {
                const shape: CanvasShape = {
                  id: createShapeId(),
                  type: "text",
                  x: textDraft.canvas.x,
                  y: textDraft.canvas.y,
                  text: value,
                  fontSize: DEFAULT_FONT_SIZE,
                  color: DEFAULT_TEXT_COLOR,
                };
                commit([...workingRef.current, shape]);
              }
            }
          }}
        />
      )}
    </div>
  );
}
