"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@tipkit/components";
import { AlignLeft, AlignCenter, AlignRight, type LucideIcon } from "lucide-react";
import { useT, type Translate } from "@tipkit/core";
import { ToolbarBtn } from "./toolbar-button";

/* 对齐菜单（迁移自 blog align-menu.tsx） */
const OPTIONS: { key: string; labelKey: string; icon: LucideIcon }[] = [
  { key: "left", labelKey: "toolbar.alignLeft", icon: AlignLeft },
  { key: "center", labelKey: "toolbar.alignCenter", icon: AlignCenter },
  { key: "right", labelKey: "toolbar.alignRight", icon: AlignRight },
];

export function AlignMenu({ editor, t }: { editor: Editor; t?: Translate }) {
  const ctxT = useT();
  const tr = t ?? ctxT;
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((o) => editor.isActive({ textAlign: o.key })) ?? OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title={tr("toolbar.align")} active={open}>
              <ActiveIcon className="tk-icon-md" />
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tr("toolbar.align")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-36 tk-p-1">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <DropdownMenuItem
              key={o.key}
              onSelect={(e) => {
                e.preventDefault();
                editor.chain().focus().setTextAlign(o.key).run();
                setOpen(false);
              }}
              className={active.key === o.key ? "tk-bg-primary-10 tk-text-primary" : ""}
            >
              <Icon className="tk-icon-md" />
              {tr(o.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
