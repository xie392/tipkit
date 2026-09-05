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
import { getInsertActions, getSlashGroupLabel, SLASH_GROUP_ORDER, type InsertAction } from "@tipkit/extensions";
import { FindReplacePanel } from "@/components/find-replace-panel";
import { useDemoLang } from "@/components/use-demo-lang";
import {
  Badge,
  Bold,
  Brush,
  Check,
  ChevronDown,
  ChevronDownSquare,
  Code,
  Code2,
  Columns2,
  Eraser,
  FileInput,
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
  SpellCheck,
  Table2,
  Text,
  TriangleAlert,
  Underline,
  Undo2,
  Video,
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
  Badge,
  Brush,
  Superscript,
  Video,
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
  const [findOpen, setFindOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const { t } = useDemoLang();
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
            t,
          })
        : [],
    [editor, insertOpen, t],
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
              aria-label={t("slash.group.basic")}
              data-active={insertOpen || undefined}
              className="tk-toolbar-add inline-flex items-center justify-center w-7 h-7 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-80">
            <InsertPanel
              actions={insertActions}
              onSelect={() => setInsertOpen(false)}
            />
          </PopoverContent>
        </Popover>
        <Tip label={`${t("toolbar.undo")} ⌘Z`}>
          <ToolbarBtn icon={Undo2} label={t("toolbar.undo")} onClick={() => chain().undo().run()} />
        </Tip>
        <Tip label={`${t("toolbar.redo")} ⌘⇧Z`}>
          <ToolbarBtn icon={Redo2} label={t("toolbar.redo")} onClick={() => chain().redo().run()} />
        </Tip>

        <ToolbarDivider />

        <BlockStyleMenu editor={editor} t={t} />
        <FontFamilyPicker editor={editor} t={t} />
        <FontSizePicker editor={editor} t={t} />

        <Tip label={`${t("toolbar.bold")} ⌘B`}>
          <ToolbarBtn icon={Bold} label={t("toolbar.bold")} active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
        </Tip>
        <Tip label={`${t("toolbar.italic")} ⌘I`}>
          <ToolbarBtn icon={Italic} label={t("toolbar.italic")} active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
        </Tip>
        <Tip label={`${t("toolbar.strike")} ⌘⇧X`}>
          <ToolbarBtn icon={Strikethrough} label={t("toolbar.strike")} active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
        </Tip>
        <Tip label={`${t("toolbar.underline")} ⌘U`}>
          <ToolbarBtn icon={Underline} label={t("toolbar.underline")} active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
        </Tip>

        {/* 文本更多：字体族 / 上标 / 下标 / 行内代码 / 清除格式 */}
        <DropdownMenu open={textOpen} onOpenChange={setTextOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("toolbar.moreText")}
              data-active={textOpen || editor.isActive("superscript") || editor.isActive("subscript") || editor.isActive("code") || undefined}
              className="tk-toolbar-btn inline-flex items-center justify-center h-8 gap-0.5 px-1.5 rounded text-sm font-medium"
            >
              T<ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <MoreItem icon={Superscript} label={t("toolbar.superscript")} active={editor.isActive("superscript")} onClick={() => chain().toggleSuperscript().run()} />
            <MoreItem icon={Subscript} label={t("toolbar.subscript")} active={editor.isActive("subscript")} onClick={() => chain().toggleSubscript().run()} />
            <MoreItem icon={Code} label={t("toolbar.code")} active={editor.isActive("code")} onClick={() => chain().toggleCode().run()} />
            <DropdownMenuSeparator />
            <MoreItem icon={Eraser} label={t("toolbar.clearFormat")} onClick={() => chain().unsetAllMarks().clearNodes().run()} />
          </DropdownMenuContent>
        </DropdownMenu>

        <ColorMenu editor={editor} mode="text" t={t} />
        <ColorMenu editor={editor} mode="highlight" t={t} />

        <ToolbarDivider />

        <AlignMenu editor={editor} t={t} />

        <ToolbarDivider />

        <Tip label={t("toolbar.orderedList")}>
          <ToolbarBtn icon={ListOrdered} label={t("toolbar.orderedList")} active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
        </Tip>
        <Tip label={t("toolbar.bulletList")}>
          <ToolbarBtn icon={List} label={t("toolbar.bulletList")} active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
        </Tip>

        <ToolbarDivider />

        <Tip label={t("toolbar.taskList")}>
          <ToolbarBtn icon={ListChecks} label={t("toolbar.taskList")} active={editor.isActive("taskList")} onClick={() => chain().toggleTaskList().run()} />
        </Tip>
        <Tip label={`${t("toolbar.insertLink")} ⌘K`}>
          <ToolbarBtn
            icon={Link}
            label={t("toolbar.insertLink")}
            active={editor.isActive("link")}
            onClick={() => openLinkDialog()}
          />
        </Tip>
        <Tip label={t("toolbar.blockquote")}>
          <ToolbarBtn icon={Quote} label={t("toolbar.blockquote")} active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
        </Tip>
        <Tip label={t("toolbar.separator")}>
          <ToolbarBtn icon={Minus} label={t("toolbar.separator")} onClick={() => chain().setHorizontalRule().run()} />
        </Tip>

        <ToolbarDivider />

        <Tip label={t("toolbar.image")}>
          <ToolbarBtn icon={ImageIcon} label={t("toolbar.image")} onClick={() => fileRef.current?.click()} />
        </Tip>
        <TablePicker editor={editor} t={t} />
        <Tip label={t("toolbar.codeBlock")}>
          <ToolbarBtn icon={Code2} label={t("toolbar.codeBlock")} active={editor.isActive("codeBlock")} onClick={() => chain().toggleCodeBlock().run()} />
        </Tip>

        {/* 语法检查（LanguageTool，headless 装饰高亮） */}
        <Tip label={t("toolbar.grammarCheck")}>
          <ToolbarBtn
            icon={SpellCheck}
            label={t("toolbar.grammarCheck")}
            onClick={() => editor.chain().checkLanguageTool().run()}
          />
        </Tip>

        {/* 导入文档（ImportDoc 扩展，转换函数由消费方注入） */}
        <Tip label={t("toolbar.importDoc")}>
          <ToolbarBtn
            icon={FileInput}
            label={t("toolbar.importDoc")}
            onClick={() => docFileRef.current?.click()}
          />
        </Tip>

        {/* 查找替换（语雀式面板） */}
        <Popover
          open={findOpen}
          onOpenChange={(open) => {
            setFindOpen(open);
            if (!open) editor.chain().clearSearch().run();
          }}
        >
          <PopoverTrigger asChild>
            <ToolbarBtn icon={Search} label={t("toolbar.findReplace")} active={findOpen} onClick={() => setFindOpen((v) => !v)} />
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8}>
            <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />
          </PopoverContent>
        </Popover>

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
        <input
          ref={docFileRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void editor.commands.importDocument(file);
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

function InsertPanel({
  actions,
  onSelect,
}: {
  actions: InsertAction[];
  onSelect: () => void;
}) {
  const [query, setQuery] = useState("");
  const { t } = useDemoLang();
  const q = query.trim().toLowerCase();

  const filtered = q
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.aliases?.some((al) => al.toLowerCase().includes(q)),
      )
    : actions;

  const groups = SLASH_GROUP_ORDER.map((g) => ({
    group: g,
    label: getSlashGroupLabel(g, t),
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
          placeholder={t("slash.searchPlaceholder")}
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
          <div className="tk-insert-empty">{t("slash.insertEmpty")}</div>
        )}
        {groups.map(({ group, label, items }) => (
          <div key={group} className="tk-insert-group">
            <div className="tk-insert-group-title">{label}</div>
            <div className="tk-insert-grid">
              {items.map((item) => {
                const Icon = INSERT_ICONS[item.icon];
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.available}
                    title={item.label}
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
