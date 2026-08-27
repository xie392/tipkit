"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { parseShapes, shapesToJSON, type CanvasShape, type CanvasStyle } from "./canvas-types";
import { CanvasView } from "./canvas-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvas: {
      /** 在光标处插入一个画板块 */
      setCanvas: () => ReturnType;
      /** 更新画板节点属性（width/height/shapes/style/snap） */
      updateCanvas: (attrs: Partial<CanvasAttrs>) => ReturnType;
    };
  }
}

export interface CanvasAttrs {
  width: number;
  height: number;
  shapes: CanvasShape[];
  /** 渲染风格：auto=跟随主题 / clean=清晰 / sketch=手绘 */
  style: CanvasStyle;
  /** 网格吸附 */
  snap: boolean;
}

/**
 * 画板块节点：独占整行的 atom 节点。
 * 全部绘制内容保存在 attrs.shapes，通过更新属性（新 transaction）实现撤销/重做。
 */
export const Canvas = Node.create({
  name: "canvas",

  group: "block",

  atom: true,

  isolating: true,

  draggable: true,

  content: "",

  addAttributes() {
    return {
      width: {
        default: 800,
        parseHTML: (el) => {
          const v = parseInt((el as HTMLElement).getAttribute("data-width") || "", 10);
          return Number.isFinite(v) ? v : 800;
        },
        renderHTML: (attrs) => ({ "data-width": attrs.width }),
      },
      height: {
        default: 450,
        parseHTML: (el) => {
          const v = parseInt((el as HTMLElement).getAttribute("data-height") || "", 10);
          return Number.isFinite(v) ? v : 450;
        },
        renderHTML: (attrs) => ({ "data-height": attrs.height }),
      },
      shapes: {
        default: [],
        parseHTML: (el) => parseShapes((el as HTMLElement).getAttribute("data-shapes")),
        renderHTML: (attrs) => ({ "data-shapes": shapesToJSON((attrs.shapes as CanvasShape[]) || []) }),
      },
      style: {
        default: "auto",
        parseHTML: (el) => {
          const v = (el as HTMLElement).getAttribute("data-style");
          return v === "clean" || v === "sketch" ? v : "auto";
        },
        renderHTML: (attrs) => ({ "data-style": attrs.style }),
      },
      snap: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-snap") === "true",
        renderHTML: (attrs) => ({ "data-snap": attrs.snap ? "true" : "false" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='canvas']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "canvas", class: "tk-canvas-wrap" })];
  },

  addCommands() {
    return {
      setCanvas:
        () =>
        ({ commands }) =>
          commands.insertContent(`<div data-type="canvas"></div>`),
      updateCanvas:
        (attrs: Partial<CanvasAttrs>) =>
        ({ commands }) =>
          commands.updateAttributes("canvas", attrs),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasView);
  },
});

export default Canvas;
