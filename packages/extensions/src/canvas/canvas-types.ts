/**
 * 画板（Canvas）数据模型与几何工具（纯逻辑，无视觉样式）。
 * 定义绘制元素的联合类型、画布视图类型，以及序列化/命中检测/包围盒等辅助函数。
 */

export interface Point {
  x: number;
  y: number;
}

export type CanvasTool =
  | "select"
  | "hand"
  | "brush"
  | "pencil"
  | "text"
  | "rect"
  | "circle"
  | "arrow"
  | "line"
  | "image"
  | "box";

/** 画布视图状态（局部 UI 状态，不写入文档属性） */
export interface CanvasView {
  x: number;
  y: number;
  zoom: number;
}

/** 填充样式 */
export type CanvasFillStyle = "none" | "solid" | "hachure";
/** 线条端点样式 */
export type CanvasHead = "none" | "arrow" | "dot";
/** 画板整体绘制风格 */
export type CanvasStyle = "auto" | "clean" | "sketch";

/** 元素通用可选样式字段 */
interface ShapeStyle {
  rotation?: number;
  /** 是否虚线描边 */
  dash?: boolean;
  /** 填充样式 */
  fillStyle?: CanvasFillStyle;
  /** 线条端点样式（line/arrow） */
  head?: CanvasHead;
}

/** 绘制元素联合类型 */
export type CanvasShape =
  | (ShapeStyle & { id: string; type: "rect"; x: number; y: number; w: number; h: number; fill: string; stroke: string; strokeWidth: number })
  | (ShapeStyle & { id: string; type: "circle"; x: number; y: number; r: number; fill: string; stroke: string; strokeWidth: number })
  | (ShapeStyle & { id: string; type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number })
  | (ShapeStyle & { id: string; type: "arrow"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number })
  | (ShapeStyle & { id: string; type: "path"; points: Point[]; stroke: string; strokeWidth: number })
  | (ShapeStyle & { id: string; type: "text"; x: number; y: number; text: string; fontSize: number; color: string })
  | (ShapeStyle & { id: string; type: "image"; x: number; y: number; w: number; h: number; src: string });

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const SHAPE_TYPES = ["rect", "circle", "line", "arrow", "path", "text", "image"];

/** 绘制元素的默认内容颜色（属于文档内容数据，非扩展 UI 样式） */
export const DEFAULT_STROKE = "#334155";
export const DEFAULT_FILL = "none";
export const DEFAULT_TEXT_COLOR = "#111827";
export const DEFAULT_FONT_SIZE = 16;

/** 生成画布元素唯一 ID */
export function createShapeId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 序列化 shapes 为 JSON 字符串（用于 HTML data-shapes 属性） */
export function shapesToJSON(shapes: CanvasShape[]): string {
  return JSON.stringify(shapes);
}

/** 解析 shapes。非法/缺字段返回 []（不抛错）。 */
export function parseShapes(raw: unknown): CanvasShape[] {
  if (typeof raw !== "string") return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidShape) as CanvasShape[];
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidShape(shape: unknown): boolean {
  if (!shape || typeof shape !== "object") return false;
  const s = shape as Record<string, unknown>;
  if (typeof s.id !== "string") return false;
  if (!SHAPE_TYPES.includes(s.type as string)) return false;
  switch (s.type) {
    case "rect":
      return ["x", "y", "w", "h"].every((k) => isNumber(s[k]));
    case "circle":
      return ["x", "y", "r"].every((k) => isNumber(s[k]));
    case "line":
    case "arrow":
      return ["x1", "y1", "x2", "y2"].every((k) => isNumber(s[k]));
    case "path":
      return Array.isArray(s.points) && (s.points as unknown[]).every((p) => isPoint(p));
    case "text":
      return isNumber(s.x) && isNumber(s.y) && typeof s.text === "string";
    case "image":
      return ["x", "y", "w", "h"].every((k) => isNumber(s[k])) && typeof s.src === "string";
    default:
      return false;
  }
}

function isPoint(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return isNumber(o.x) && isNumber(o.y);
}

/** 计算元素的最小包围盒（供框选、渲染裁剪） */
export function getShapeBounds(shape: CanvasShape): Bounds {
  switch (shape.type) {
    case "rect":
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
    case "circle":
      return { minX: shape.x - shape.r, minY: shape.y - shape.r, maxX: shape.x + shape.r, maxY: shape.y + shape.r };
    case "line":
    case "arrow":
      return {
        minX: Math.min(shape.x1, shape.x2),
        minY: Math.min(shape.y1, shape.y2),
        maxX: Math.max(shape.x1, shape.x2),
        maxY: Math.max(shape.y1, shape.y2),
      };
    case "path":
      return pointsBounds(shape.points);
    case "text":
      return {
        minX: shape.x,
        minY: shape.y - shape.fontSize,
        maxX: shape.x + Math.max(shape.text.length * shape.fontSize * 0.6, 8),
        maxY: shape.y,
      };
    case "image":
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
  }
}

export function pointsBounds(points: Point[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const HIT_THRESHOLD = 6;

/** 绕点 (cx, cy) 旋转坐标（angleDeg 为角度） */
export function rotatePoint(x: number, y: number, angleDeg: number, cx: number, cy: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** 元素几何中心（局部坐标系，不考虑旋转） */
export function getShapeCenter(shape: CanvasShape): Point {
  const b = getShapeBounds(shape);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** 点是否命中某元素（供选择工具点击命中；自动处理旋转：把点转到局部系再判定） */
export function pointInShape(px: number, py: number, shape: CanvasShape): boolean {
  const rot = shape.rotation || 0;
  if (rot) {
    const c = getShapeCenter(shape);
    const lp = rotatePoint(px, py, -rot, c.x, c.y);
    return pointInShapeLocal(lp.x, lp.y, shape);
  }
  return pointInShapeLocal(px, py, shape);
}

function pointInShapeLocal(px: number, py: number, shape: CanvasShape): boolean {
  switch (shape.type) {
    case "rect":
      return px >= shape.x && px <= shape.x + shape.w && py >= shape.y && py <= shape.y + shape.h;
    case "circle":
      return Math.hypot(px - shape.x, py - shape.y) <= shape.r;
    case "line":
    case "arrow":
      return distToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) <= Math.max(shape.strokeWidth, HIT_THRESHOLD);
    case "path": {
      const pts = shape.points;
      const thr = Math.max(shape.strokeWidth, HIT_THRESHOLD);
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= thr) return true;
      }
      return pts.length > 0 && Math.hypot(px - pts[0].x, py - pts[0].y) <= thr;
    }
    case "text":
      return getShapeBounds(shape).minX <= px && px <= getShapeBounds(shape).maxX && getShapeBounds(shape).minY <= py && py <= getShapeBounds(shape).maxY;
    case "image":
      return px >= shape.x && px <= shape.x + shape.w && py >= shape.y && py <= shape.y + shape.h;
  }
}

/** 框选矩形是否与元素相交（供框选工具） */
export function boxIntersectsShape(box: Bounds, shape: CanvasShape): boolean {
  const b = getShapeBounds(shape);
  return !(box.maxX < b.minX || box.minX > b.maxX || box.maxY < b.minY || box.minY > b.maxY);
}

/** 平移元素（dx, dy），返回新对象 */
export function translateShape(shape: CanvasShape, dx: number, dy: number): CanvasShape {
  switch (shape.type) {
    case "rect":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "circle":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "line":
    case "arrow":
      return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
    case "path":
      return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "image":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
  }
}

/** 将屏幕坐标换算为画布坐标（考虑视图平移与缩放） */
export function screenToCanvas(sx: number, sy: number, view: CanvasView): Point {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom };
}

/** 生成自由画笔路径（平滑折线：按固定步长采样，减少点数） */
export function buildPathPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const minDist = 2 / 1; // 画布坐标系下的最小采样间距
  const out: Point[] = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) {
      out.push(p);
      last = p;
    }
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
