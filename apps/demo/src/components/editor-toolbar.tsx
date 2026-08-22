"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignMenu,
  BlockStyleMenu,
  ColorMenu,
  FontFamilyPicker,
  FontSizePicker,
  TablePicker,
} from "@tipkit/ui";
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
 * 订阅 selectionUpdate/update，保证按钮激活态与可用性实时刷新。
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
    <div className="tk-toolbar flex flex-wrap items-center gap-1">
      <BlockStyleMenu editor={editor} />
      <ToolbarDivider />
      <ToolbarBtn icon={Undo2} label="撤销" onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarBtn icon={Redo2} label="重做" onClick={() => editor.chain().focus().redo().run()} />
      <ToolbarDivider />
      <ToolbarBtn icon={Bold} label="加粗 ⌘B" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarBtn icon={Italic} label="斜体 ⌘I" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarBtn icon={Strikethrough} label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolbarBtn icon={Underline} label="下划线 ⌘U" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarBtn icon={Code} label="行内代码" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} />
      <ToolbarDivider />
      <ColorMenu editor={editor} mode="text" />
      <ColorMenu editor={editor} mode="highlight" />
      <FontFamilyPicker editor={editor} />
      <FontSizePicker editor={editor} />
      <ToolbarDivider />
      <AlignMenu editor={editor} />
      <ToolbarDivider />
      <ToolbarBtn icon={List} label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarBtn icon={ListOrdered} label="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarBtn icon={ListChecks} label="任务列表" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      <ToolbarBtn icon={Quote} label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarBtn icon={Code2} label="代码块" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <div className="inline-flex items-center">
        <TablePicker editor={editor} />
      </div>
      <ToolbarDivider />
      <ToolbarBtn
        icon={Link}
        label="插入链接"
        disabled={editor.state.selection.empty}
        onClick={() => {
          const href = window.prompt("链接地址（https://…）");
          if (href) editor.chain().focus().setLink({ href }).run();
        }}
      />
    </div>
  );
}

function ToolbarBtn({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-active={active || undefined}
      className="tk-toolbar-btn inline-flex items-center justify-center w-8 h-8 rounded"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="tk-toolbar-divider w-px h-5 bg-border mx-1" />;
}
