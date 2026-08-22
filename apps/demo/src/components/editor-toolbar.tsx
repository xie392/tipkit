"use client";

import { forwardRef, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignMenu,
  BlockStyleMenu,
  ColorMenu,
  FontFamilyPicker,
  FontSizePicker,
  TablePicker,
} from "@tipkit/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tipkit/components";
import {
  Bold,
  Code,
  Code2,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";

/**
 * 顶部通栏工具栏：渲染在页面 header 下方（sticky 工具条内），
 * 视觉由各主题的 .tk-toolbar-btn 样式驱动。
 * 每个按钮带 tooltip（Radix），hover 300ms 后显示，明确按钮用途。
 */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => force((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("update", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("update", refresh);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="tk-toolbar flex flex-wrap items-center gap-1">
        <BlockStyleMenu editor={editor} />
        <ToolbarDivider />
        <Tip label="撤销 ⌘Z">
          <ToolbarBtn icon={Undo2} label="撤销" onClick={() => editor.chain().focus().undo().run()} />
        </Tip>
        <Tip label="重做 ⌘⇧Z">
          <ToolbarBtn icon={Redo2} label="重做" onClick={() => editor.chain().focus().redo().run()} />
        </Tip>
        <ToolbarDivider />
        <Tip label="加粗 ⌘B">
          <ToolbarBtn icon={Bold} label="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        </Tip>
        <Tip label="斜体 ⌘I">
          <ToolbarBtn icon={Italic} label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        </Tip>
        <Tip label="删除线 ⌘⇧X">
          <ToolbarBtn icon={Strikethrough} label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
        </Tip>
        <Tip label="下划线 ⌘U">
          <ToolbarBtn icon={Underline} label="下划线" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        </Tip>
        <Tip label="行内代码 ⌘E">
          <ToolbarBtn icon={Code} label="行内代码" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} />
        </Tip>
        <ToolbarDivider />
        <ColorMenu editor={editor} mode="text" />
        <ColorMenu editor={editor} mode="highlight" />
        <FontFamilyPicker editor={editor} />
        <FontSizePicker editor={editor} />
        <ToolbarDivider />
        <AlignMenu editor={editor} />
        <ToolbarDivider />
        <Tip label="无序列表">
          <ToolbarBtn icon={List} label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        </Tip>
        <Tip label="有序列表">
          <ToolbarBtn icon={ListOrdered} label="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        </Tip>
        <Tip label="任务列表">
          <ToolbarBtn icon={ListChecks} label="任务列表" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />
        </Tip>
        <Tip label="引用块">
          <ToolbarBtn icon={Quote} label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        </Tip>
        <Tip label="代码块">
          <ToolbarBtn icon={Code2} label="代码块" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        </Tip>
        <TablePicker editor={editor} />
        <ToolbarDivider />
        <Tip label="插入链接 ⌘K">
          <ToolbarBtn
            icon={Link}
            label="插入链接"
            disabled={editor.state.selection.empty}
            onClick={() => {
              const href = window.prompt("链接地址（https://…）");
              if (href) editor.chain().focus().setLink({ href }).run();
            }}
          />
        </Tip>
      </div>
    </TooltipProvider>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const ToolbarBtn = forwardRef<
  HTMLButtonElement,
  {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">
>(function ToolbarBtn({ icon: Icon, label, active, disabled, onClick, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-active={active || undefined}
      className="tk-toolbar-btn inline-flex items-center justify-center w-8 h-8 rounded"
      {...rest}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
});

function ToolbarDivider() {
  return <span className="tk-toolbar-divider w-px h-5 bg-border mx-1" />;
}
