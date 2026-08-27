"use client";

import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@tipkit/components";
import { useT } from "@tipkit/core";
import type { CanvasFillStyle, CanvasHead, CanvasShape } from "./canvas-types";
import type { ZDirection } from "./canvas-tools";

/* 选中元素时的浮动样式工具栏：虚线 / 箭头端点 / 填充样式 / 图层顺序。
 * 仅布局与激活态，颜色走 themes。 */

interface Props {
  shapes: CanvasShape[];
  dashActive: boolean;
  onToggleDash: () => void;
  onSetHead: (h: CanvasHead) => void;
  onSetFill: (f: CanvasFillStyle) => void;
  onZ: (dir: ZDirection) => void;
}

/** 元素工具栏按钮：带 tooltip（在按钮上方） */
function TipButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={className}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function CanvasElementToolbar({ shapes, dashActive, onToggleDash, onSetHead, onSetFill, onZ }: Props) {
  const t = useT();
  const hasLine = shapes.some((s) => s.type === "line" || s.type === "arrow");
  const hasFill = shapes.some((s) => s.type === "rect" || s.type === "circle" || s.type === "path");
  const head = shapes.some((s) => (s.type === "line" || s.type === "arrow") && s.head) ? shapes.find((s) => s.type === "line" || s.type === "arrow")?.head ?? "none" : "none";
  const fill = shapes.find((s) => s.type === "rect" || s.type === "circle" || s.type === "path")?.fillStyle ?? "none";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="tk-canvas-element-toolbar"
        contentEditable={false}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <TipButton
          label={t("canvas.dash")}
          className={`tk-canvas-tool${dashActive ? " is-active" : ""}`}
          onClick={onToggleDash}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 12h4M10 12h4M16 12h4" />
          </svg>
        </TipButton>

        {hasLine && (
          <>
            <span className="tk-canvas-sep" />
            {(["none", "arrow", "dot"] as CanvasHead[]).map((h) => (
              <TipButton
                key={h}
                label={t(`canvas.head.${h}`)}
                className={`tk-canvas-tool${head === h ? " is-active" : ""}`}
                onClick={() => onSetHead(h)}
              >
                {h === "none" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16" /></svg>}
                {h === "arrow" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h14M14 6l6 6-6 6" /></svg>}
                {h === "dot" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h13" /><circle cx="19" cy="12" r="2" fill="currentColor" /></svg>}
              </TipButton>
            ))}
          </>
        )}

        {hasFill && (
          <>
            <span className="tk-canvas-sep" />
            {(["none", "solid", "hachure"] as CanvasFillStyle[]).map((f) => (
              <TipButton
                key={f}
                label={t(`canvas.fill.${f}`)}
                className={`tk-canvas-tool${fill === f ? " is-active" : ""}`}
                onClick={() => onSetFill(f)}
              >
                {f === "none" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="5" width="14" height="14" rx="1" /></svg>}
                {f === "solid" && <svg width="16" height="16" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="currentColor" /></svg>}
                {f === "hachure" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="5" y="5" width="14" height="14" rx="1" />
                    <path d="M8 5l-3 3M12 5l-7 7M16 5l-11 11M20 5l-15 15M20 9l-11 11M20 13l-7 7M20 17l-3 3" />
                  </svg>
                )}
              </TipButton>
            ))}
          </>
        )}

        <span className="tk-canvas-sep" />
        <TipButton label={t("canvas.zTop")} className="tk-canvas-tool" onClick={() => onZ("top")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </TipButton>
        <TipButton label={t("canvas.zUp")} className="tk-canvas-tool" onClick={() => onZ("up")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 19V6M6 12l6-6 6 6" /></svg>
        </TipButton>
        <TipButton label={t("canvas.zDown")} className="tk-canvas-tool" onClick={() => onZ("down")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v13M6 12l6 6 6-6" /></svg>
        </TipButton>
        <TipButton label={t("canvas.zBottom")} className="tk-canvas-tool" onClick={() => onZ("bottom")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </TipButton>
      </div>
    </TooltipProvider>
  );
}
