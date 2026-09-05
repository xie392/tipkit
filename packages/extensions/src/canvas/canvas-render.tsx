"use client";

import React from "react";
import type { CanvasShape, CanvasView } from "./canvas-types";
import type { Corner } from "./canvas-tools";
import { getShapeBounds, getShapeCenter, rotatePoint } from "./canvas-types";
import { toRoughHtml } from "./canvas-rough";
import { arrowHead } from "./canvas-tools";

/* 画布形状的 SVG 渲染（清晰/手绘两种模式）与选区、缩放/旋转手柄。
 * 纯函数：输入形状与视图状态，输出 JSX，不持有交互状态。 */

const isRealColor = (c?: string): c is string => !!c && c !== "none" && c !== "transparent";

function renderCleanShape(s: CanvasShape): React.ReactNode {
  const dashArr = s.dash ? "8 6" : undefined;
  // 清晰模式下 fill：solid/hachure 都用填充色实心（hachure 主要服务于手绘主题）
  const fillFor = (stroke: string, fill: string): string =>
    s.fillStyle === "none" || !s.fillStyle ? "none" : isRealColor(fill) ? fill : stroke;
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
}

export function renderShapeEl(s: CanvasShape, rough: boolean): React.ReactNode {
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
}

export function renderSelectionEl(s: CanvasShape): React.ReactNode {
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
}

/** 缩放手柄 + 旋转手柄（屏幕坐标系，尺寸恒定不随缩放变化；随元素旋转） */
export function renderResizeHandleEls(s: CanvasShape, view: CanvasView): React.ReactNode[] {
  const HS = 8;
  const b = getShapeBounds(s);
  const c = getShapeCenter(s);
  const rot = s.rotation || 0;
  // 局部系四角 + 顶边中点，旋转到屏幕坐标系
  const local: { c: Corner | "rt"; x: number; y: number }[] = [
    { c: "tl", x: b.minX, y: b.minY },
    { c: "tr", x: b.maxX, y: b.minY },
    { c: "bl", x: b.minX, y: b.maxY },
    { c: "br", x: b.maxX, y: b.maxY },
    { c: "rt", x: c.x, y: b.minY }, // 旋转手柄位置（顶边中点）
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
}
