import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { Canvas, createBasicExtensions } from "../../src/index";
import {
  parseShapes,
  shapesToJSON,
  pointInShape,
  boxIntersectsShape,
  translateShape,
  getShapeBounds,
  getShapeCenter,
  rotatePoint,
  createShapeId,
  type CanvasShape,
} from "../../src/canvas/canvas-types";
import { updateDraft, resizeShapeByBox, computeNewBounds, makeBaseShape } from "../../src/canvas/canvas-tools";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), Canvas],
    content: content ?? "",
  });
}

function findCanvas(editor: Editor) {
  let found: { node: any; pos: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "canvas") {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}

const RECT: CanvasShape = { id: "r1", type: "rect", x: 10, y: 20, w: 100, h: 50, fill: "none", stroke: "#334155", strokeWidth: 2 };

describe("Canvas 节点", () => {
  it("setCanvas 插入 canvas 节点（atom）", () => {
    const editor = makeEditor();
    editor.chain().focus().setCanvas().run();
    const found = findCanvas(editor);
    expect(found).not.toBeNull();
    expect(found!.node.type.isAtom).toBe(true);
    expect(found!.node.attrs.width).toBe(800);
    expect(found!.node.attrs.height).toBe(450);
    expect(found!.node.attrs.shapes).toEqual([]);
    editor.destroy();
  });

  it("updateCanvas 更新 shapes", () => {
    const editor = makeEditor();
    editor.chain().focus().setCanvas().run();
    editor.chain().focus().updateCanvas({ shapes: [RECT] }).run();
    const { node } = findCanvas(editor)!;
    expect(node.attrs.shapes).toHaveLength(1);
    expect(node.attrs.shapes[0].type).toBe("rect");
    editor.destroy();
  });

  it("getJSON 输出包含 shapes", () => {
    const editor = makeEditor();
    editor.chain().focus().setCanvas().run();
    editor.chain().focus().updateCanvas({ shapes: [RECT] }).run();
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain("canvas");
    expect(json).toContain("r1");
    editor.destroy();
  });

  it("HTML 往返保留 shapes", () => {
    const editor = makeEditor();
    editor.chain().focus().setCanvas().run();
    editor.chain().focus().updateCanvas({ shapes: [RECT] }).run();
    const html = editor.getHTML();
    expect(html).toContain('data-type="canvas"');
    expect(html).toContain("data-shapes");

    const editor2 = makeEditor(html);
    const { node } = findCanvas(editor2)!;
    expect(node.attrs.shapes).toHaveLength(1);
    expect(node.attrs.shapes[0].id).toBe("r1");
    editor.destroy();
    editor2.destroy();
  });

  it("撤销/重做回退画布 shapes 变化", () => {
    // 初始内容中的 canvas 不在历史中，使 updateCanvas 成为唯一历史步骤
    const editor = makeEditor('<div data-type="canvas"></div>');
    expect(findCanvas(editor)!.node.attrs.shapes).toHaveLength(0);

    editor.chain().focus().updateCanvas({ shapes: [RECT] }).run();
    expect(findCanvas(editor)!.node.attrs.shapes).toHaveLength(1);

    editor.chain().focus().undo().run();
    // canvas 仍在，shapes 回退为空
    expect(findCanvas(editor)!.node.attrs.shapes).toHaveLength(0);

    editor.chain().focus().redo().run();
    expect(findCanvas(editor)!.node.attrs.shapes).toHaveLength(1);
    editor.destroy();
  });
});

describe("Canvas 数据模型", () => {
  it("parseShapes 合法 JSON 正确还原", () => {
    const json = shapesToJSON([RECT]);
    const parsed = parseShapes(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "r1", type: "rect", x: 10, y: 20, w: 100, h: 50 });
  });

  it("parseShapes 对非法/缺失字段返回 []", () => {
    expect(parseShapes("not json")).toEqual([]);
    expect(parseShapes("42")).toEqual([]);
    expect(parseShapes(null)).toEqual([]);
    expect(parseShapes(JSON.stringify([{ id: "x", type: "rect" }]))).toEqual([]);
    expect(parseShapes(JSON.stringify([{ id: "x", type: "unknown" }]))).toEqual([]);
  });

  it("createShapeId 生成唯一 ID", () => {
    const a = createShapeId();
    const b = createShapeId();
    expect(a).not.toBe(b);
  });
});

describe("Canvas 几何工具", () => {
  it("pointInShape 命中矩形", () => {
    expect(pointInShape(50, 40, RECT)).toBe(true);
    expect(pointInShape(5, 5, RECT)).toBe(false);
  });

  it("pointInShape 命中线", () => {
    const line: CanvasShape = { id: "l", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, stroke: "#000", strokeWidth: 2 };
    expect(pointInShape(50, 2, line)).toBe(true);
    expect(pointInShape(50, 40, line)).toBe(false);
  });

  it("boxIntersectsShape 框选相交", () => {
    expect(boxIntersectsShape({ minX: 0, minY: 0, maxX: 60, maxY: 60 }, RECT)).toBe(true);
    expect(boxIntersectsShape({ minX: 0, minY: 0, maxX: 5, maxY: 5 }, RECT)).toBe(false);
  });

  it("translateShape 平移元素", () => {
    const moved = translateShape(RECT, 5, -3);
    expect(moved.x).toBe(15);
    expect(moved.y).toBe(17);
    // 原对象不变
    expect(RECT.x).toBe(10);
  });

  it("getShapeBounds 计算包围盒", () => {
    const b = getShapeBounds(RECT);
    expect(b).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });
});

describe("Canvas 工具函数", () => {
  it("updateDraft 约束 Shift 时矩形变正方形", () => {
    const base = makeBaseShape("rect", { x: 0, y: 0 });
    const square = updateDraft(base, { x: 30, y: 12 }, true);
    expect(square.w).toBe(30);
    expect(square.h).toBe(30);
  });

  it("updateDraft 约束 Shift 时圆形变正圆", () => {
    const base = makeBaseShape("circle", { x: 0, y: 0 });
    const c = updateDraft(base, { x: 20, y: 10 }, true);
    expect(c.r).toBe(20);
  });

  it("updateDraft 约束 Shift 时线条吸附 45°", () => {
    const base = makeBaseShape("line", { x: 0, y: 0 });
    const l = updateDraft(base, { x: 10, y: 10 }, true);
    // 45° 方向，x2≈y2
    expect(Math.abs(l.x2 - l.y2)).toBeLessThan(0.001);
  });

  it("resizeShapeByBox 缩放矩形", () => {
    const orig = getShapeBounds(RECT); // {10,20,110,70}
    const nb = computeNewBounds(orig, "br", { x: 210, y: 120 });
    const resized = resizeShapeByBox(RECT, orig, nb);
    expect(resized.x).toBe(10);
    expect(resized.y).toBe(20);
    expect(resized.w).toBe(200);
    expect(resized.h).toBe(100);
  });

  it("rotatePoint 旋转坐标", () => {
    const p = rotatePoint(10, 0, 90, 0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("pointInShape 处理旋转元素", () => {
    // 水平条旋转 90° 后变为竖直条
    const bar: CanvasShape = { id: "bar", type: "rect", x: 0, y: 0, w: 100, h: 20, fill: "none", stroke: "#000", strokeWidth: 2, rotation: 90 };
    expect(getShapeCenter(bar)).toEqual({ x: 50, y: 10 });
    expect(pointInShape(50, 15, bar)).toBe(true);
    expect(pointInShape(15, 10, bar)).toBe(false);
  });

  it("序列化保留 rotation", () => {
    const json = shapesToJSON([{ ...RECT, rotation: 45 }]);
    const parsed = parseShapes(json);
    expect(parsed[0].rotation).toBe(45);
  });
});
