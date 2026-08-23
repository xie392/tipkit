"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@tipkit/components";
import { Highlighter, Palette } from "lucide-react";
import { ToolbarBtn } from "./toolbar-button";

/* 颜色菜单（迁移自 blog color-menu.tsx）：
 * mode: text（文字色）/ highlight（高亮），含灰阶/色相网格/最近使用/自定义。 */

interface ColorMenuProps {
  editor: Editor;
  mode: "text" | "highlight";
}

const GRAY_SCALE = [
  "#000000",
  "#434343",
  "#595959",
  "#8c8c8c",
  "#bfbfbf",
  "#d9d9d9",
  "#e8e8e8",
  "#f0f0f0",
  "#ffffff",
];

const HUES: { name: string; text: string[]; highlight: string[] }[] = [
  { name: "红", text: ["#5c0011", "#a8071a", "#cf1322", "#f5222d", "#ff7875", "#ffa39e"], highlight: ["#fff1f0", "#ffccc7", "#ffa39e", "#ff7875", "#ff4d4f", "#f5222d"] },
  { name: "橙红", text: ["#610b00", "#ad2102", "#d4380d", "#fa541c", "#ff9c6e", "#ffbb96"], highlight: ["#fff2e8", "#ffd8bf", "#ffbb96", "#ff9c6e", "#ff7a45", "#fa541c"] },
  { name: "橙", text: ["#612500", "#ad4e00", "#d46b08", "#fa8c16", "#ffc069", "#ffd591"], highlight: ["#fff7e6", "#ffe7ba", "#ffd591", "#ffc069", "#ffa940", "#fa8c16"] },
  { name: "金", text: ["#613400", "#ad6800", "#d48806", "#faad14", "#ffd666", "#ffe58f"], highlight: ["#fffbe6", "#fff1b8", "#ffe58f", "#ffd666", "#ffc53d", "#faad14"] },
  { name: "青柠", text: ["#254000", "#5b8c00", "#7cb305", "#a0d911", "#d3f261", "#eaff8f"], highlight: ["#fcffe6", "#f4ffb8", "#eaff8f", "#d3f261", "#bae637", "#a0d911"] },
  { name: "绿", text: ["#092b00", "#237804", "#389e0d", "#52c41a", "#95de64", "#b7eb8f"], highlight: ["#f6ffed", "#d9f7be", "#b7eb8f", "#95de64", "#73d13d", "#52c41a"] },
  { name: "青", text: ["#002329", "#006d75", "#08979c", "#13c2c2", "#5cdbd3", "#87e8de"], highlight: ["#e6fffb", "#b5f5ec", "#87e8de", "#5cdbd3", "#36cfc9", "#13c2c2"] },
  { name: "蓝", text: ["#002766", "#0050b3", "#096dd9", "#1890ff", "#69c0ff", "#91d5ff"], highlight: ["#e6f7ff", "#bae7ff", "#91d5ff", "#69c0ff", "#40a9ff", "#1890ff"] },
  { name: "紫", text: ["#120338", "#391085", "#531dab", "#722ed1", "#b37feb", "#d3adf7"], highlight: ["#f9f0ff", "#efdbff", "#d3adf7", "#b37feb", "#9254de", "#722ed1"] },
  { name: "品红", text: ["#520339", "#9e1068", "#c41d7f", "#eb2f96", "#ff85c0", "#ffadd2"], highlight: ["#fff0f6", "#ffd6e7", "#ffadd2", "#ff85c0", "#f759ab", "#eb2f96"] },
];

const STORAGE_KEY = "tk-editor-recent-colors";
const MAX_RECENT = 10;

function loadRecent(mode: "text" | "highlight"): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}-${mode}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(mode: "text" | "highlight", color: string) {
  if (typeof window === "undefined") return;
  try {
    const list = loadRecent(mode).filter((c) => c.toLowerCase() !== color.toLowerCase());
    list.unshift(color);
    window.localStorage.setItem(`${STORAGE_KEY}-${mode}`, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

function Swatch({ color, active, onClick, title }: { color: string; active?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title ?? color}
      aria-label={title ?? color}
      className="tk-flex tk-icon-lg tk-items-center tk-justify-center tk-rounded-sm tk-transition-transform tk-hover-scale-110"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span
        className={`tk-block tk-icon-md tk-rounded-3px tk-border tk-border-border${active ? " tk-swatch-active" : ""}`}
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

export function ColorMenu({ editor, mode }: ColorMenuProps) {
  const isText = mode === "text";
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecent(mode));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeColor = isText
    ? (editor.getAttributes("textStyle").color as string | undefined)
    : (editor.getAttributes("highlight").color as string | undefined);

  const applyColor = (color: string) => {
    if (isText) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().toggleHighlight({ color }).run();
    }
    saveRecent(mode, color);
    setRecent(loadRecent(mode));
  };

  const clear = () => {
    if (isText) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
  };

  const palette = isText
    ? HUES[0].text.map((_, rowIdx) => HUES.map((h) => h.text[rowIdx]))
    : HUES[0].highlight.map((_, rowIdx) => HUES.map((h) => h.highlight[rowIdx]));

  const active = activeColor?.toLowerCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn active={open}>
              {isText ? <Palette className="tk-icon-md" /> : <Highlighter className="tk-icon-md" />}
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{isText ? "文字颜色" : "高亮颜色"}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-56 tk-p-2">
        {/* 灰阶 */}
        <div className="tk-mb-2 tk-flex tk-flex-wrap tk-gap-0-5">
          {GRAY_SCALE.map((color) => (
            <Swatch
              key={color}
              color={color}
              active={active === color.toLowerCase()}
              onClick={() => applyColor(color)}
            />
          ))}
        </div>

        {/* 色相网格 */}
        <div className="tk-flex tk-flex-col tk-gap-1">
          {palette.map((row, rowIdx) => (
            <div key={rowIdx} className="tk-flex tk-gap-1">
              {row.map((color) => (
                <Swatch
                  key={color}
                  color={color}
                  active={active === color.toLowerCase()}
                  onClick={() => applyColor(color)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* 最近使用 */}
        {recent.length > 0 && (
          <div className="tk-mt-2 tk-border-t tk-border-border tk-pt-2">
            <div className="tk-mb-1 tk-text-11px tk-opacity-50">最近使用</div>
            <div className="tk-flex tk-flex-wrap tk-gap-0-5">
              {recent.map((color) => (
                <Swatch
                  key={color}
                  color={color}
                  active={active === color.toLowerCase()}
                  onClick={() => applyColor(color)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 自定义颜色 + 清除 */}
        <div className="tk-mt-2 tk-flex tk-items-center tk-gap-1 tk-border-t tk-border-border tk-pt-2">
          <button
            type="button"
            className="tk-flex tk-flex-1 tk-items-center tk-gap-1-5 tk-rounded-md tk-px-1-5 tk-py-1 tk-text-xs tk-opacity-70 tk-transition-colors tk-hover-bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <span
              className="tk-icon-sm tk-rounded-full tk-border tk-border-border"
              style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
            />
            更多颜色
          </button>
          {activeColor && (
            <button
              type="button"
              className="tk-rounded-md tk-px-1-5 tk-py-1 tk-text-xs tk-opacity-70 tk-transition-colors tk-hover-bg-accent"
              onClick={clear}
            >
              清除{isText ? "颜色" : "高亮"}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="color"
          className="tk-sr-only"
          onChange={(e) => applyColor(e.target.value)}
          value={activeColor ?? "#000000"}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
