"use client";

import type { Editor } from "@tiptap/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@tipkit/components";
import { Text, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, ChevronDown, type LucideIcon } from "lucide-react";
import { ToolbarBtn } from "./toolbar-button";

/* 块样式菜单（迁移自 blog block-style-menu.tsx）：正文 + 标题 1-6 */
interface BlockStyle {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const BLOCK_STYLES: BlockStyle[] = [
  {
    label: "正文",
    icon: Text,
    isActive: (editor) => editor.isActive("paragraph"),
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  ...([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((level) => ({
    label: `标题 ${level}`,
    icon: [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1],
    isActive: (editor: Editor) => editor.isActive("heading", { level }),
    run: (editor: Editor) => editor.chain().focus().toggleHeading({ level }).run(),
  })),
];

export function BlockStyleMenu({ editor }: { editor: Editor }) {
  const activeStyle = BLOCK_STYLES.find((item) => item.isActive(editor)) ?? BLOCK_STYLES[0];
  const ActiveIcon = activeStyle.icon;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ToolbarBtn title="块样式" className="tk-w-fit tk-px-2">
              <span className="tk-flex tk-items-center tk-gap-1 tk-text-12px">
                <ActiveIcon className="tk-icon-md" />
                <span className="tk-truncate">{activeStyle.label}</span>
                <ChevronDown className="tk-icon-sm tk-opacity-60" />
              </span>
            </ToolbarBtn>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">块样式</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="tk-w-36">
        {BLOCK_STYLES.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.label} onClick={() => item.run(editor)}>
              <Icon className="tk-mr-2 tk-icon-md tk-opacity-60" />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
