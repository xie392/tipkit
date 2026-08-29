"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@tipkit/core";
import { renderMermaid } from "./mermaid-renderer";
import {
  IconClose,
  IconDownload,
  IconMinus,
  IconPlus,
} from "./mermaid-icons";

export type CodeBlockTheme = "light" | "dark";

const RENDER_DEBOUNCE_MS = 400;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const WHEEL_SENSITIVITY = 0.0015;

interface MermaidPreviewProps {
  code: string;
  theme: CodeBlockTheme;
  /** 全屏查看器是否打开（状态由父级 CodeBlockView 管理） */
  fullscreen: boolean;
  onCloseFullscreen: () => void;
}

/** mermaid 预览面板：防抖渲染 + 错误提示 + 可选全屏查看器 */
export function MermaidPreview({ code, theme, fullscreen, onCloseFullscreen }: MermaidPreviewProps) {
  const t = useT();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      renderMermaid(code, theme)
        .then((result) => {
          if (cancelled) return;
          setSvg(result);
          setError("");
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message);
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, theme]);

  return (
    <>
      <div className="tk-mermaid-preview" contentEditable={false}>
        {error ? (
          <div className="tk-mermaid-error">{error}</div>
        ) : svg ? (
          <div className="tk-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : null}
      </div>
      {fullscreen && typeof document !== "undefined" && (
        <MermaidViewer svg={svg} theme={theme} onClose={onCloseFullscreen} t={t} />
      )}
    </>
  );
}

interface MermaidViewerProps {
  svg: string;
  theme: CodeBlockTheme;
  onClose: () => void;
  t: (key: string) => string;
}

function downloadSvg(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mermaid-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 全屏查看器：滚轮缩放（以光标为中心）+ 拖拽平移 + 下载 */
function MermaidViewer({ svg, theme, onClose, t }: MermaidViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const stateRef = useRef({ scale, position });
  stateRef.current = { scale, position };

  const clampScale = useCallback((value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)), []);

  const zoomAt = useCallback(
    (nextScale: number, cx?: number, cy?: number) => {
      const next = clampScale(nextScale);
      if (cx !== undefined && cy !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dx = cx - rect.left - rect.width / 2;
        const dy = cy - rect.top - rect.height / 2;
        const diff = next - stateRef.current.scale;
        setPosition((p) => ({ x: p.x - dx * diff, y: p.y - dy * diff }));
      }
      setScale(next);
    },
    [clampScale]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomAt(stateRef.current.scale + ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomAt(stateRef.current.scale - ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, zoomAt]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomAt(stateRef.current.scale - e.deltaY * WHEEL_SENSITIVITY, e.clientX, e.clientY);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (stateRef.current.scale <= 1) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: stateRef.current.position.x,
      baseY: stateRef.current.position.y,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPosition({ x: drag.baseX + e.clientX - drag.startX, y: drag.baseY + e.clientY - drag.startY });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return createPortal(
    <div
      className={`tk-mermaid-viewer ${theme === "dark" ? "tk-mermaid-viewer-dark" : "tk-mermaid-viewer-light"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="tk-mermaid-viewer-close" onClick={onClose} title="Esc">
        <IconClose />
      </button>
      <div
        ref={containerRef}
        className="tk-mermaid-viewer-stage"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={() => {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        }}
      >
        <div
          className="tk-mermaid-viewer-svg"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? "grab" : "default",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="tk-mermaid-viewer-actions">
        <button type="button" onClick={() => zoomAt(stateRef.current.scale - ZOOM_STEP)} title="-">
          <IconMinus />
        </button>
        <span className="tk-mermaid-viewer-scale">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomAt(stateRef.current.scale + ZOOM_STEP)} title="+">
          <IconPlus />
        </button>
        <button type="button" onClick={() => downloadSvg(svg)} title={t("codeBlock.downloadSvg")}>
          <IconDownload />
        </button>
      </div>
    </div>,
    document.body
  );
}
