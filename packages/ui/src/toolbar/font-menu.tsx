"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@tipkit/components";
import { Type, ChevronDown } from "lucide-react";
import { useT, type Translate } from "@tipkit/core";
import { ToolbarBtn } from "./toolbar-button";

/* 字体/字号选择器（迁移自 blog font-menu.tsx） */
interface Option {
  labelKey: string;
  value: string;
}

const FONT_FAMILIES: Option[] = [
  { labelKey: "toolbar.fontFamilyDefault", value: "" },
  { labelKey: "toolbar.fontFamilySans", value: "ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { labelKey: "toolbar.fontFamilySerif", value: "ui-serif, Georgia, 'Songti SC', 'STSong', 'SimSun', serif" },
  { labelKey: "toolbar.fontFamilyMono", value: "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace" },
  { labelKey: "toolbar.fontFamilyKai", value: "'KaiTi', 'STKaiti', 'Kaiti SC', serif" },
  { labelKey: "toolbar.fontFamilyHei", value: "'Heiti SC', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { labelKey: "toolbar.fontFamilySong", value: "'Songti SC', 'STSong', 'SimSun', serif" },
];

const FONT_SIZES: { value: string }[] = [
  { value: "" },
  { value: "12px" },
  { value: "14px" },
  { value: "16px" },
  { value: "18px" },
  { value: "20px" },
  { value: "24px" },
  { value: "28px" },
  { value: "32px" },
  { value: "36px" },
  { value: "42px" },
  { value: "48px" },
];

export function FontFamilyPicker({ editor, t }: { editor: Editor; t?: Translate }) {
  const ctxT = useT();
  const tr = t ?? ctxT;
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const currentOpt = FONT_FAMILIES.find((f) => f.value === current);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title={tr("toolbar.fontFamily")} className="tk-w-fit tk-px-2">
              <span className="tk-flex tk-items-center tk-gap-1 tk-text-12px">
                <Type className="tk-icon-md" />
                <span className="tk-max-w-60px tk-truncate">
                  {currentOpt ? tr(currentOpt.labelKey) : tr("toolbar.fontFamily")}
                </span>
                <ChevronDown className="tk-icon-sm tk-opacity-60" />
              </span>
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tr("toolbar.fontFamily")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-44">
        {FONT_FAMILIES.map((opt) => (
          <DropdownMenuItem
            key={opt.labelKey + opt.value}
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
            {tr(opt.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FontSizePicker({ editor, t }: { editor: Editor; t?: Translate }) {
  const ctxT = useT();
  const tr = t ?? ctxT;
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title={tr("toolbar.fontSize")} className="tk-w-fit tk-px-2">
              <span className="tk-flex tk-items-center tk-gap-1 tk-text-12px">
                <span className="tk-max-w-40px tk-truncate">{current || tr("toolbar.fontSize")}</span>
                <ChevronDown className="tk-icon-sm tk-opacity-60" />
              </span>
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tr("toolbar.fontSize")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-32">
        {FONT_SIZES.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
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
            {opt.value || tr("toolbar.fontSizeDefault")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
