"use client";

import rough from "roughjs";
import type { CanvasShape } from "./canvas-types";

/* 手绘渲染：用 rough.js 的 svg 渲染器直接生成 Excalidraw 风格的手绘 SVG 节点，
 * 再取其 outerHTML 字符串（含抖动描边 + 斜线填充）。 */

let cachedSvg: SVGSVGElement | null = null;
let cachedRc: ReturnType<typeof rough.svg> | null = null;

function getRough() {
  if (!cachedRc) {
    cachedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    cachedRc = rough.svg(cachedSvg);
  }
  return cachedRc;
}

/** 由元素 id 生成稳定的随机种子，避免每次渲染图形抖动变化 */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function isRealColor(c?: string): c is string {
  return !!c && c !== "none" && c !== "transparent";
}

/** 计算箭头头部三角点（画布坐标） */
function headPoints(x1: number, y1: number, x2: number, y2: number, size = 12): [number, number][] {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - size * Math.cos(ang);
  const by = y2 - size * Math.sin(ang);
  const px = -Math.sin(ang) * size * 0.4;
  const py = Math.cos(ang) * size * 0.4;
  return [
    [x2, y2],
    [bx + px, by + py],
    [bx - px, by - py],
  ];
}

const fillable = (s: CanvasShape): s is Extract<CanvasShape, { type: "rect" | "circle" }> =>
  s.type === "rect" || s.type === "circle";

/** 元素 -> 手绘 SVG 标记字符串；text/image 不支持手绘，返回空串由上层走清晰渲染 */
export function toRoughHtml(shape: CanvasShape): string {
  if (shape.type === "text" || shape.type === "image") return "";

  const rc = getRough();
  const stroke = shape.stroke;
  const sw = shape.strokeWidth;
  const dash = shape.dash;

  const options: Record<string, unknown> = {
    roughness: 1.2,
    bowing: 1.2,
    stroke,
    strokeWidth: sw,
    seed: seedOf(shape.id),
    disableMultiStroke: false,
  };
  if (dash) options.strokeLineDash = [8, 6];

  if (fillable(shape)) {
    const fillStyle = shape.fillStyle || "none";
    const fillColor = isRealColor(shape.fill) ? shape.fill : stroke;
    if (fillStyle === "solid") {
      options.fill = fillColor;
      options.fillStyle = "solid";
    } else if (fillStyle === "hachure") {
      options.fill = fillColor;
      options.fillStyle = "hachure";
      options.fillWeight = 0.6;
      options.hachureGap = 5;
    }
  }

  const solidHead = (): Record<string, unknown> => ({ ...options, fill: stroke, fillStyle: "solid", stroke: "none" });

  switch (shape.type) {
    case "rect":
      return rc.rectangle(shape.x, shape.y, shape.w, shape.h, options).outerHTML;
    case "circle":
      return rc.circle(shape.x, shape.y, shape.r * 2, options).outerHTML;
    case "line": {
      const head = shape.head || "none";
      const shaft = rc.line(shape.x1, shape.y1, shape.x2, shape.y2, options).outerHTML;
      if (head === "arrow") {
        return shaft + rc.polygon(headPoints(shape.x1, shape.y1, shape.x2, shape.y2), solidHead()).outerHTML;
      }
      if (head === "dot") {
        const r = Math.max(sw, 4);
        return shaft + rc.circle(shape.x2, shape.y2, r * 2, solidHead()).outerHTML;
      }
      return shaft;
    }
    case "arrow":
      return (
        rc.line(shape.x1, shape.y1, shape.x2, shape.y2, options).outerHTML +
        rc.polygon(headPoints(shape.x1, shape.y1, shape.x2, shape.y2), solidHead()).outerHTML
      );
    case "path":
      return rc.linearPath(shape.points as unknown as never[], options).outerHTML;
    default:
      return "";
  }
}
