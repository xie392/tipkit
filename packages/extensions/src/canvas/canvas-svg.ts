"use client";

import type { CanvasShape } from "./canvas-types";
import { getShapeCenter } from "./canvas-types";
import { toRoughHtml } from "./canvas-rough";

/* 导出画板为 SVG 字符串（供导出 PNG 用）。
 * 清晰形状用简单矢量标签；手绘形状复用 rough 渲染。 */

const isRealColor = (c?: string): c is string => !!c && c !== "none" && c !== "transparent";

function arrowHeadStr(x1: number, y1: number, x2: number, y2: number, size = 12): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - size * Math.cos(ang);
  const by = y2 - size * Math.sin(ang);
  const px = -Math.sin(ang) * size * 0.4;
  const py = Math.cos(ang) * size * 0.4;
  return `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

function cleanShapeToSvg(s: CanvasShape): string {
  switch (s.type) {
    case "rect": {
      const stroke = s.stroke;
      const fillColor = s.fillStyle === "none" || !s.fillStyle ? "none" : isRealColor(s.fill) ? s.fill : stroke;
      return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fillColor}" stroke="${stroke}" stroke-width="${s.strokeWidth}"${dashAttr(s)}/>`;
    }
    case "circle": {
      const stroke = s.stroke;
      const fillColor = s.fillStyle === "none" || !s.fillStyle ? "none" : isRealColor(s.fill) ? s.fill : stroke;
      return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${fillColor}" stroke="${stroke}" stroke-width="${s.strokeWidth}"${dashAttr(s)}/>`;
    }
    case "line": {
      const stroke = s.stroke;
      const base = `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${s.strokeWidth}"${dashAttr(s)}/>`;
      const head = s.head || "none";
      if (head === "arrow") return `${base}<polygon points="${arrowHeadStr(s.x1, s.y1, s.x2, s.y2)}" fill="${stroke}"/>`;
      if (head === "dot") return `${base}<circle cx="${s.x2}" cy="${s.y2}" r="${Math.max(s.strokeWidth, 4)}" fill="${stroke}"/>`;
      return base;
    }
    case "arrow": {
      const stroke = s.stroke;
      return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${s.strokeWidth}"${dashAttr(s)}/><polygon points="${arrowHeadStr(s.x1, s.y1, s.x2, s.y2)}" fill="${stroke}"/>`;
    }
    case "path": {
      const d = s.points.length > 1 ? `M ${s.points[0].x} ${s.points[0].y} L ${s.points.slice(1).map((p) => `${p.x} ${p.y}`).join(" L ")}` : "";
      return `<path d="${d}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${dashAttr(s)} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case "text":
      return `<text x="${s.x}" y="${s.y}" font-size="${s.fontSize}" fill="${s.color}" font-family="sans-serif">${escapeXml(s.text)}</text>`;
    case "image":
      return `<image x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" href="${escapeXml(s.src)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
}

const dashAttr = (s: CanvasShape): string => (s.dash ? ' stroke-dasharray="8 6"' : "");

function escapeXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shapeToSvg(s: CanvasShape, rough: boolean): string {
  const inner =
    rough && s.type !== "text" && s.type !== "image"
      ? toRoughHtml(s) || cleanShapeToSvg(s)
      : cleanShapeToSvg(s);
  const rot = s.rotation || 0;
  if (rot) {
    const c = getShapeCenter(s);
    return `<g transform="rotate(${rot} ${c.x} ${c.y})">${inner}</g>`;
  }
  return inner;
}

/** 生成画板 SVG 字符串（白底） */
export function shapesToSvg(shapes: CanvasShape[], width: number, height: number, rough: boolean): string {
  const body = shapes.map((s) => shapeToSvg(s, rough)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${body}</svg>`;
}

/** 把 SVG 字符串栅格化为 PNG dataURL（scale 为清晰度倍率） */
export function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 渲染失败"));
    };
    img.src = url;
  });
}
