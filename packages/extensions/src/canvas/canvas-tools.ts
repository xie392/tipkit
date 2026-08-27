/**
 * 画板绘制与几何工具（纯逻辑，无视觉样式）。
 * 绘制基元生成、拖拽预览更新、命中判定后的缩放/约束计算等。
 */
import type { CanvasShape, CanvasTool, Point, Bounds } from "./canvas-types";
import {
  createShapeId,
  getShapeBounds,
  buildPathPoints,
  DEFAULT_STROKE,
  DEFAULT_FILL,
} from "./canvas-types";

export const DRAW_TOOLS: CanvasTool[] = ["rect", "circle", "arrow", "line", "brush", "pencil"];

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type Corner = "tl" | "tr" | "bl" | "br";

/** 生成绘制基元（以按下点为起点） */
export function makeBaseShape(tool: CanvasTool, p: Point): CanvasShape {
  const id = createShapeId();
  switch (tool) {
    case "rect":
      return { id, type: "rect", x: p.x, y: p.y, w: 0, h: 0, fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, strokeWidth: 2 };
    case "circle":
      return { id, type: "circle", x: p.x, y: p.y, r: 0, fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, strokeWidth: 2 };
    case "line":
      return { id, type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: DEFAULT_STROKE, strokeWidth: 2 };
    case "arrow":
      return { id, type: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: DEFAULT_STROKE, strokeWidth: 2 };
    case "brush":
      return { id, type: "path", points: [p], stroke: DEFAULT_STROKE, strokeWidth: 4 };
    case "pencil":
      return { id, type: "path", points: [p], stroke: DEFAULT_STROKE, strokeWidth: 2 };
    default:
      return { id, type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: DEFAULT_STROKE, strokeWidth: 2 };
  }
}

/** 更新拖拽预览（constrain=true 时约束比例/角度：矩形正方、圆正圆、线/箭头 45° 吸附） */
export function updateDraft(base: CanvasShape, p: Point, constrain: boolean): CanvasShape {
  switch (base.type) {
    case "rect": {
      const x = Math.min(base.x, p.x);
      const y = Math.min(base.y, p.y);
      let w = Math.abs(p.x - base.x);
      let h = Math.abs(p.y - base.y);
      if (constrain) {
        const m = Math.max(w, h);
        w = m;
        h = m;
      }
      return { ...base, x, y, w, h };
    }
    case "circle": {
      const r = constrain ? Math.max(Math.abs(p.x - base.x), Math.abs(p.y - base.y)) : Math.hypot(p.x - base.x, p.y - base.y);
      return { ...base, r };
    }
    case "line":
    case "arrow": {
      if (constrain) {
        const dx = p.x - base.x1;
        const dy = p.y - base.y1;
        const ang = Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 45) * 45;
        const len = Math.hypot(dx, dy);
        return { ...base, x2: base.x1 + Math.cos((ang * Math.PI) / 180) * len, y2: base.y1 + Math.sin((ang * Math.PI) / 180) * len };
      }
      return { ...base, x2: p.x, y2: p.y };
    }
    case "path":
      return { ...base, points: buildPathPoints([...base.points, p]) };
    default:
      return base;
  }
}

/** 计算箭头箭头三角点 */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 12): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const baseX = x2 - size * Math.cos(ang);
  const baseY = y2 - size * Math.sin(ang);
  const px = -Math.sin(ang) * size * 0.4;
  const py = Math.cos(ang) * size * 0.4;
  return `${x2},${y2} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`;
}

/** 丢弃无意义的空图形（点击未拖动产生） */
export function isValidDraft(d: CanvasShape): boolean {
  switch (d.type) {
    case "path":
      return d.points.length > 1;
    case "rect":
      return d.w > 2 && d.h > 2;
    case "circle":
      return d.r > 2;
    case "line":
    case "arrow":
      return Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4;
    default:
      return true;
  }
}

const MIN_RESIZE = 5;

/** 根据拖拽角计算新的包围盒（锚定对角，夹紧最小尺寸防翻转） */
export function computeNewBounds(orig: Bounds, corner: Corner, p: Point): Bounds {
  switch (corner) {
    case "br":
      return { minX: orig.minX, minY: orig.minY, maxX: Math.max(p.x, orig.minX + MIN_RESIZE), maxY: Math.max(p.y, orig.minY + MIN_RESIZE) };
    case "tr":
      return { minX: orig.minX, maxX: Math.max(p.x, orig.minX + MIN_RESIZE), maxY: orig.maxY, minY: Math.min(p.y, orig.maxY - MIN_RESIZE) };
    case "bl":
      return { minX: Math.min(p.x, orig.maxX - MIN_RESIZE), minY: orig.minY, maxX: orig.maxX, maxY: Math.max(p.y, orig.minY + MIN_RESIZE) };
    case "tl":
      return { minX: Math.min(p.x, orig.maxX - MIN_RESIZE), minY: Math.min(p.y, orig.maxY - MIN_RESIZE), maxX: orig.maxX, maxY: orig.maxY };
  }
}

/** 按包围盒线性缩放元素（从原始包围盒映射到新包围盒，支持全部元素类型） */
export function resizeShapeByBox(shape: CanvasShape, orig: Bounds, nb: Bounds): CanvasShape {
  const ow = Math.max(1, orig.maxX - orig.minX);
  const oh = Math.max(1, orig.maxY - orig.minY);
  const nw = Math.max(1, nb.maxX - nb.minX);
  const nh = Math.max(1, nb.maxY - nb.minY);
  const map = (vx: number, vy: number): Point => ({
    x: nb.minX + ((vx - orig.minX) / ow) * nw,
    y: nb.minY + ((vy - orig.minY) / oh) * nh,
  });
  switch (shape.type) {
    case "rect": {
      const a = map(shape.x, shape.y);
      const b = map(shape.x + shape.w, shape.y + shape.h);
      return { ...shape, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }
    case "image": {
      const a = map(shape.x, shape.y);
      const b = map(shape.x + shape.w, shape.y + shape.h);
      return { ...shape, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }
    case "circle": {
      const a = map(shape.x - shape.r, shape.y - shape.r);
      const b = map(shape.x + shape.r, shape.y + shape.r);
      const r = Math.max(1, Math.min((b.x - a.x) / 2, (b.y - a.y) / 2));
      return { ...shape, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r };
    }
    case "line":
    case "arrow": {
      const a = map(shape.x1, shape.y1);
      const b = map(shape.x2, shape.y2);
      return { ...shape, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    case "path":
      return { ...shape, points: shape.points.map((pt) => map(pt.x, pt.y)) };
    case "text": {
      const m = map(shape.x, shape.y);
      const scale = nw / ow;
      return { ...shape, x: m.x, y: m.y, fontSize: Math.max(6, shape.fontSize * scale) };
    }
  }
}

/** 通用元素包围盒（供渲染/命中）——转发自 canvas-types，便于集中导入 */
export { getShapeBounds };
