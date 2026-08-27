"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEditorEditable, useEditorDeps, useT } from "@tipkit/core";
import { CanvasToolbar, ExitFullscreenIcon } from "./canvas-toolbar";
import { CanvasBoard } from "./canvas-board";
import type { CanvasShape, CanvasTool, CanvasView } from "./canvas-types";
import { createShapeId } from "./canvas-types";

/**
 * 画板 NodeView：独占整行的带边框容器。
 * - 内部持有当前工具与画布视图状态（局部 UI 状态）
 * - 全部绘制内容通过 updateAttributes({ shapes }) 持久化到节点属性
 * - 容器 contentEditable=false，画布内绘制不干扰外部编辑器
 */
export function CanvasView({ node, editor, updateAttributes }: NodeViewProps) {
  const isEditable = useEditorEditable(editor);
  const deps = useEditorDeps();
  const t = useT();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [view, setView] = useState<CanvasView>({ x: 0, y: 0, zoom: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 网页内全屏：状态切换（非系统 Fullscreen API），全屏时锁定页面滚动
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((s) => !s);
  }, []);

  const width = (node.attrs.width as number) || 800;
  const height = (node.attrs.height as number) || 450;
  const shapes = (node.attrs.shapes as CanvasShape[]) || [];

  const handleChange = useCallback(
    (next: CanvasShape[]) => {
      updateAttributes({ shapes: next });
    },
    [updateAttributes],
  );

  const handleImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      let src = "";
      try {
        src = deps.uploadImage ? await deps.uploadImage(file, editor) : URL.createObjectURL(file);
      } catch {
        return;
      }
      const shape: CanvasShape = { id: createShapeId(), type: "image", x: 60, y: 60, w: 220, h: 150, src };
      const current = (node.attrs.shapes as CanvasShape[]) || [];
      updateAttributes({ shapes: [...current, shape] });
    };
    input.click();
  }, [deps, editor, node, updateAttributes]);

  // 全屏时用 Portal 挂到 body，避免祖先 transform/overflow 裁剪 fixed 元素
  const frame = (
    <div className={`tk-canvas-frame${isFullscreen ? " is-fullscreen" : ""}`}>
      {isFullscreen && (
        <div className="tk-canvas-header">
          <span className="tk-canvas-header-title">{t("canvas.title")}</span>
          <button
            type="button"
            className="tk-canvas-header-exit"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleFullscreen}
          >
            <ExitFullscreenIcon />
            {t("canvas.exitFullscreen")}
          </button>
        </div>
      )}
      <div className="tk-canvas-body">
        {isEditable && (
          <CanvasToolbar
            tool={tool}
            onToolChange={setTool}
            zoom={view.zoom}
            onZoomIn={() => setView((v) => zoomView(v, 1.2, width, height))}
            onZoomOut={() => setView((v) => zoomView(v, 1 / 1.2, width, height))}
            onImage={handleImage}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
        <CanvasBoard
          shapes={shapes}
          width={width}
          height={height}
          tool={tool}
          editable={isEditable}
          view={view}
          onViewChange={setView}
          onChange={handleChange}
        />
      </div>
    </div>
  );

  return (
    <NodeViewWrapper className="tk-canvas-wrap" data-type="canvas" contentEditable={false}>
      {isFullscreen ? createPortal(frame, document.body) : frame}
    </NodeViewWrapper>
  );
}

function zoomView(v: CanvasView, factor: number, cw: number, ch: number): CanvasView {
  const cx = cw / 2;
  const cy = ch / 2;
  const newZoom = Math.min(3, Math.max(0.25, v.zoom * factor));
  const k = newZoom / v.zoom;
  return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, zoom: newZoom };
}
