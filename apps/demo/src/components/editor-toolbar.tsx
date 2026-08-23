"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignMenu,
  BlockStyleMenu,
  ColorMenu,
  FontFamilyPicker,
  FontSizePicker,
  TablePicker,
  openLinkDialog,
} from "@tipkit/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tipkit/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tipkit/components";
import { getInsertActions, type InsertAction } from "@tipkit/extensions";
import {
  Bold,
  Check,
  ChevronDown,
  ChevronDownSquare,
  Code,
  Code2,
  Columns2,
  Eraser,
  Frame,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Paperclip,
  Plus,
  Quote,
  Redo2,
  Search,
  Sigma,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Text,
  TriangleAlert,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";

const INSERT_ICONS: Record<string, LucideIcon> = {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Text,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Table2,
  Minus,
  Image: ImageIcon,
  Link,
  Columns2,
  ChevronDownSquare,
  ListTree,
  TriangleAlert,
  Sigma,
  Frame,
  Paperclip,
  Smile,
};

/**
 * 顶部通栏工具栏（单行），顺序参考语雀：
 * + 撤销 重做 | 正文 字号 B I S U [T更多] 文字色 高亮 | 对齐 | 有序 无序 |
 * 任务 链接 引用 分隔线 | 图片 表格 代码块
 */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0);
  const [textOpen, setTextOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const insertActions = useMemo(
    () =>
      editor
        ? getInsertActions({
            editor,
            openImagePicker: () => fileRef.current?.click(),
            openLinkDialog,
          })
        : [],
    [editor, insertOpen],
  );

  if (!editor) return null;

  const chain = () => editor.chain().focus();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="tk-toolbar flex flex-nowrap items-center gap-0.5 overflow-x-auto whitespace-nowrap">
        {/* 插入：+ 打开可搜索分组面板 */}
        <Popover open={insertOpen} onOpenChange={setInsertOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="插入"
              data-active={insertOpen || undefined}
              className="tk-toolbar-add inline-flex items-center justify-center w-7 h-7 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-80 p-0">
            <InsertPanel
              actions={insertActions}
              onSelect={() => setInsertOpen(false)}
            />
          </PopoverContent>
        </Popover>
        <Tip label="撤销 ⌘Z">
          <ToolbarBtn icon={Undo2} label="撤销" onClick={() => chain().undo().run()} />
        </Tip>
        <Tip label="重做 ⌘⇧Z">
          <ToolbarBtn icon={Redo2} label="重做" onClick={() => chain().redo().run()} />
        </Tip>

        <ToolbarDivider />

        <BlockStyleMenu editor={editor} />
        <FontFamilyPicker editor={editor} />
        <FontSizePicker editor={editor} />

        <Tip label="加粗 ⌘B">
          <ToolbarBtn icon={Bold} label="加粗" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
        </Tip>
        <Tip label="斜体 ⌘I">
          <ToolbarBtn icon={Italic} label="斜体" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
        </Tip>
        <Tip label="删除线 ⌘⇧X">
          <ToolbarBtn icon={Strikethrough} label="删除线" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
        </Tip>
        <Tip label="下划线 ⌘U">
          <ToolbarBtn icon={Underline} label="下划线" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
        </Tip>

        {/* 文本更多：字体族 / 上标 / 下标 / 行内代码 / 清除格式 */}
        <DropdownMenu open={textOpen} onOpenChange={setTextOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="更多文本格式"
              data-active={textOpen || editor.isActive("superscript") || editor.isActive("subscript") || editor.isActive("code") || undefined}
              className="tk-toolbar-btn inline-flex items-center justify-center h-8 gap-0.5 px-1.5 rounded text-sm font-medium"
            >
              T<ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <MoreItem icon={Superscript} label="上标" active={editor.isActive("superscript")} onClick={() => chain().toggleSuperscript().run()} />
            <MoreItem icon={Subscript} label="下标" active={editor.isActive("subscript")} onClick={() => chain().toggleSubscript().run()} />
            <MoreItem icon={Code} label="行内代码" active={editor.isActive("code")} onClick={() => chain().toggleCode().run()} />
            <DropdownMenuSeparator />
            <MoreItem icon={Eraser} label="清除格式" onClick={() => chain().unsetAllMarks().clearNodes().run()} />
          </DropdownMenuContent>
        </DropdownMenu>

        <ColorMenu editor={editor} mode="text" />
        <ColorMenu editor={editor} mode="highlight" />

        <ToolbarDivider />

        <AlignMenu editor={editor} />

        <ToolbarDivider />

        <Tip label="有序列表">
          <ToolbarBtn icon={ListOrdered} label="有序列表" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
        </Tip>
        <Tip label="无序列表">
          <ToolbarBtn icon={List} label="无序列表" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
        </Tip>

        <ToolbarDivider />

        <Tip label="任务列表">
          <ToolbarBtn icon={ListChecks} label="任务列表" active={editor.isActive("taskList")} onClick={() => chain().toggleTaskList().run()} />
        </Tip>
        <Tip label="插入链接 ⌘K">
          <ToolbarBtn
            icon={Link}
            label="插入链接"
            active={editor.isActive("link")}
            onClick={() => openLinkDialog()}
          />
        </Tip>
        <Tip label="引用块">
          <ToolbarBtn icon={Quote} label="引用" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
        </Tip>
        <Tip label="分隔线">
          <ToolbarBtn icon={Minus} label="分隔线" onClick={() => chain().setHorizontalRule().run()} />
        </Tip>

        <ToolbarDivider />

        <Tip label="图片">
          <ToolbarBtn icon={ImageIcon} label="图片" onClick={() => fileRef.current?.click()} />
        </Tip>
        <TablePicker editor={editor} />
        <Tip label="代码块">
          <ToolbarBtn icon={Code2} label="代码块" active={editor.isActive("codeBlock")} onClick={() => chain().toggleCodeBlock().run()} />
        </Tip>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const src = URL.createObjectURL(file);
            chain().setImageBlock({ src }).run();
          }}
        />
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

function MoreItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick} data-active={active || undefined}>
      <Icon className="w-4 h-4" />
      {label}
      {active && <Check className="w-3.5 h-3.5 ml-auto opacity-70" />}
    </DropdownMenuItem>
  );
}

function ToolbarDivider() {
  return <span className="tk-toolbar-divider w-px h-5 bg-border mx-1" />;
}

const INSERT_GROUP_ORDER: InsertAction["group"][] = ["基础", "结构", "媒体"];

function InsertPanel({
  actions,
  onSelect,
}: {
  actions: InsertAction[];
  onSelect: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = q
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.aliases?.some((al) => al.toLowerCase().includes(q)),
      )
    : actions;

  const groups = INSERT_GROUP_ORDER.map((g) => ({
    group: g,
    items: filtered.filter((a) => a.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="tk-insert-panel">
      <div className="tk-insert-search">
        <Search className="w-4 h-4 opacity-50" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索要插入的内容"
          className="tk-insert-search-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const first = groups[0]?.items[0];
              if (first && first.available) {
                first.run();
                onSelect();
              }
            }
          }}
        />
      </div>
      <div className="tk-insert-body">
        {groups.length === 0 && (
          <div className="tk-insert-empty">没有匹配的内容</div>
        )}
        {groups.map(({ group, items }) => (
          <div key={group} className="tk-insert-group">
            <div className="tk-insert-group-title">{group}</div>
            <div className="tk-insert-grid">
              {items.map((item) => {
                const Icon = INSERT_ICONS[item.icon];
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.available}
                    title={item.description}
                    className="tk-insert-card"
                    onClick={() => {
                      if (!item.available) return;
                      item.run();
                      onSelect();
                    }}
                  >
                    <span className="tk-insert-card-icon">
                      {Icon ? <Icon className="w-4 h-4" /> : item.icon}
                    </span>
                    <span className="tk-insert-card-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
