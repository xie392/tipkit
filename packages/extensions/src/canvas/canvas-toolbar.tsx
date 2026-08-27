"use client";

import React from "react";
import { useT } from "@tipkit/core";
import type { CanvasTool } from "./canvas-types";

/* 画板工具栏：左侧垂直（绘制工具）+ 顶部悬浮（抓手/框选/缩放）。
 * 仅负责布局与激活态，颜色全部走 themes 的 .tk-canvas-* 样式。 */

interface ToolButtonProps {
  active?: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function ToolButton({ active, label, icon, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tk-canvas-tool${active ? " is-active" : ""}`}
      data-tip={label}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const SelectIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 3l14 8-6 1.5L9.5 17 7 20l1-5-3-2L5 3z" />
  </svg>
);

const HandIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14" />
    <path d="M17 9.5V10a7 7 0 0 1-2.2 5.1l-1.3 1.2a6 6 0 0 1-4 1.6H9a5 5 0 0 1-4-1.9L3.5 13a1.6 1.6 0 0 1 2.5-2L8 12.5" />
  </svg>
);

const BrushIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M9 15l6-6" />
    <path d="M19.5 4.5l-1.6-1.6a1.6 1.6 0 0 0-2.3 0L6 12.4V18h5.6l9.5-9.6a1.6 1.6 0 0 0 0-2.3z" />
    <path d="M4 20c1.5.5 2.5 0 3-1" />
  </svg>
);

const PencilIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M17 3l4 4L7.5 20.5 3 21l.5-4.5L17 3z" />
  </svg>
);

const TextIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 6V4h14v2" />
    <path d="M12 4v16" />
    <path d="M9 20h6" />
  </svg>
);

const RectIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </svg>
);

const CircleIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const ArrowIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 19L19 5" />
    <path d="M9 5h10v10" />
  </svg>
);

const LineIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 19L19 5" />
  </svg>
);

const ImageIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const BoxIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 4l16 0 0 16-16 0z" />
    <path d="M4 9h16" />
  </svg>
);

const ZoomInIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <path d="M11 8v6M8 11h6" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <path d="M8 11h6" />
  </svg>
);

const FullscreenIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M8 3H3v5" />
    <path d="M16 3h5v5" />
    <path d="M8 21H3v-5" />
    <path d="M16 21h5v-5" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M9 3v5H4" />
    <path d="M15 3v5h5" />
    <path d="M9 21v-5H4" />
    <path d="M15 21v-5h5" />
  </svg>
);
export { ExitFullscreenIcon };

/** 图标渲染：CanvasTool -> ReactNode */
export const CANVAS_TOOL_ICONS: Record<string, React.ReactNode> = {
  select: <SelectIcon />,
  hand: <HandIcon />,
  brush: <BrushIcon />,
  pencil: <PencilIcon />,
  text: <TextIcon />,
  rect: <RectIcon />,
  circle: <CircleIcon />,
  arrow: <ArrowIcon />,
  line: <LineIcon />,
  image: <ImageIcon />,
  box: <BoxIcon />,
  zoomIn: <ZoomInIcon />,
  zoomOut: <ZoomOutIcon />,
};

export interface CanvasToolbarProps {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 图片工具需要额外处理（上传/URL），由父级传入 */
  onImage: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const LEFT_TOOLS: CanvasTool[] = [
  "select",
  "hand",
  "brush",
  "pencil",
  "text",
  "rect",
  "circle",
  "arrow",
  "line",
  "image",
];

const TOOL_KEY: Record<string, string> = {
  select: "canvas.select",
  hand: "canvas.hand",
  brush: "canvas.brush",
  pencil: "canvas.pencil",
  text: "canvas.text",
  rect: "canvas.rect",
  circle: "canvas.circle",
  arrow: "canvas.arrow",
  line: "canvas.line",
  image: "canvas.image",
  box: "canvas.boxSelect",
};

export function CanvasToolbar({ tool, onToolChange, zoom, onZoomIn, onZoomOut, onImage, isFullscreen, onToggleFullscreen }: CanvasToolbarProps) {
  const t = useT();

  const handleTool = (t2: CanvasTool) => {
    if (t2 === "image") {
      onImage();
      return;
    }
    onToolChange(t2);
  };

  return (
    <>
      {/* 左侧垂直工具栏 */}
      <div className="tk-canvas-toolbar tk-canvas-toolbar-left" contentEditable={false}>
        {LEFT_TOOLS.map((t2) => (
          <ToolButton
            key={t2}
            active={tool === t2}
            label={t(TOOL_KEY[t2])}
            icon={CANVAS_TOOL_ICONS[t2]}
            onClick={() => handleTool(t2)}
          />
        ))}
      </div>

      {/* 顶部悬浮工具栏 */}
      <div className="tk-canvas-toolbar tk-canvas-toolbar-top" contentEditable={false}>
        <ToolButton
          active={tool === "hand"}
          label={t("canvas.hand")}
          icon={CANVAS_TOOL_ICONS.hand}
          onClick={() => onToolChange("hand")}
        />
        <ToolButton
          active={tool === "box"}
          label={t("canvas.boxSelect")}
          icon={CANVAS_TOOL_ICONS.box}
          onClick={() => onToolChange("box")}
        />
        <span className="tk-canvas-sep" />
        <button
          type="button"
          className="tk-canvas-tool"
          aria-label={t("canvas.zoomOut")}
          title={t("canvas.zoomOut")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onZoomOut}
        >
          {CANVAS_TOOL_ICONS.zoomOut}
        </button>
        <span className="tk-canvas-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="tk-canvas-tool"
          aria-label={t("canvas.zoomIn")}
          title={t("canvas.zoomIn")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onZoomIn}
        >
          {CANVAS_TOOL_ICONS.zoomIn}
        </button>
        <span className="tk-canvas-sep" />
        <button
          type="button"
          className="tk-canvas-tool"
          aria-label={isFullscreen ? t("canvas.exitFullscreen") : t("canvas.fullscreen")}
          title={isFullscreen ? t("canvas.exitFullscreen") : t("canvas.fullscreen")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </>
  );
}
