"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@tipkit/components";
import { Type, ChevronDown } from "lucide-react";
import { ToolbarBtn } from "./toolbar-button";

/* 字体/字号选择器（迁移自 blog font-menu.tsx） */
interface Option {
  label: string;
  value: string;
}

const FONT_FAMILIES: Option[] = [
  { label: "默认", value: "" },
  { label: "系统无衬线", value: "ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: "系统衬线", value: "ui-serif, Georgia, 'Songti SC', 'STSong', 'SimSun', serif" },
  { label: "等宽", value: "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace" },
  { label: "楷体", value: "'KaiTi', 'STKaiti', 'Kaiti SC', serif" },
  { label: "黑体", value: "'Heiti SC', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: "宋体", value: "'Songti SC', 'STSong', 'SimSun', serif" },
];

const FONT_SIZES: Option[] = [
  { label: "默认", value: "" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
  { label: "36px", value: "36px" },
  { label: "42px", value: "42px" },
  { label: "48px", value: "48px" },
];

export function FontFamilyPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title="字体" className="tk-w-fit tk-px-2">
              <span className="tk-flex tk-items-center tk-gap-1 tk-text-12px">
                <Type className="tk-icon-md" />
                <span className="tk-max-w-60px tk-truncate">
                  {FONT_FAMILIES.find((f) => f.value === current)?.label ?? "字体"}
                </span>
                <ChevronDown className="tk-icon-sm tk-opacity-60" />
              </span>
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">字体</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-44">
        {FONT_FAMILIES.map((opt) => (
          <DropdownMenuItem
            key={opt.label}
            onClick={() => {
              if (opt.value) {
                editor.chain().focus().setFontFamily(opt.value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
              setOpen(false);
            }}
            style={{ fontFamily: opt.value || undefined }}
            className={current === opt.value ? "tk-bg-primary-10 tk-text-primary" : ""}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FontSizePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title="字号" className="tk-w-fit tk-px-2">
              <span className="tk-flex tk-items-center tk-gap-1 tk-text-12px">
                <span className="tk-max-w-40px tk-truncate">{current || "字号"}</span>
                <ChevronDown className="tk-icon-sm tk-opacity-60" />
              </span>
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">字号</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-32">
        {FONT_SIZES.map((opt) => (
          <DropdownMenuItem
            key={opt.label}
            onClick={() => {
              if (opt.value) {
                editor.chain().focus().setFontSize(opt.value).run();
              } else {
                editor.chain().focus().unsetFontSize().run();
              }
              setOpen(false);
            }}
            className={current === opt.value ? "tk-bg-primary-10 tk-text-primary" : ""}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
