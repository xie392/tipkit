"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AlignMenu,
  BlockStyleMenu,
  ColorMenu,
  FontFamilyPicker,
  FontSizePicker,
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
  Table2,
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
      <ToolbarBtn icon={Table2} label="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
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
      <TableMenu editor={editor} />
    </div>
  );
}

/** 表格操作：光标/选区在表格内时显示（合并、行列、全选等） */
function TableMenu({ editor }: { editor: Editor }) {
  // 订阅 selection/内容变化，否则点击单元格不会触发重渲染
  const [, force] = useState(0);
  useEffect(() => {
    const refresh = () => force((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("update", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("update", refresh);
    };
  }, [editor]);

  if (!editor.isActive("table")) return null;
  const btn =
    "text-xs px-2 py-1 rounded-md transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none";
  return (
    <span className="ml-1 flex items-center gap-0.5 border-l border-border pl-2">
      <button
        type="button"
        title="合并选中单元格"
        disabled={!editor.can().mergeCells()}
        onClick={() => editor.chain().focus().mergeCells().run()}
        className={btn}
      >
        合并
      </button>
      <button
        type="button"
        title="拆分单元格"
        disabled={!editor.can().splitCell()}
        onClick={() => editor.chain().focus().splitCell().run()}
        className={btn}
      >
        拆分
      </button>
      <button
        type="button"
        title="上方插入行"
        disabled={!editor.can().addRowBefore()}
        onClick={() => editor.chain().focus().addRowBefore().run()}
        className={btn}
      >
        ↑行
      </button>
      <button
        type="button"
        title="下方插入行"
        disabled={!editor.can().addRowAfter()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className={btn}
      >
        ↓行
      </button>
      <button
        type="button"
        title="左侧插入列"
        disabled={!editor.can().addColumnBefore()}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        className={btn}
      >
        ←列
      </button>
      <button
        type="button"
        title="右侧插入列"
        disabled={!editor.can().addColumnAfter()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className={btn}
      >
        →列
      </button>
      <button
        type="button"
        title="删除当前行"
        disabled={!editor.can().deleteRow()}
        onClick={() => editor.chain().focus().deleteRow().run()}
        className={btn}
      >
        删行
      </button>
      <button
        type="button"
        title="删除当前列"
        disabled={!editor.can().deleteColumn()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className={btn}
      >
        删列
      </button>
      <button type="button" title="全选表格" onClick={() => selectAllCells(editor)} className={btn}>
        全选
      </button>
      <button
        type="button"
        title="删除表格"
        disabled={!editor.can().deleteTable()}
        onClick={() => editor.chain().focus().deleteTable().run()}
        className={btn}
      >
        删表
      </button>
    </span>
  );
}

/** 全选表格：把选区扩展为覆盖所有单元格的 CellSelection */
function selectAllCells(editor: Editor) {
  const { state } = editor;
  // 选区必须在表格内（表格菜单仅在表格中显示）
  const $pos = state.doc.resolve(state.selection.from);
  let depth = $pos.depth;
  while (depth > 0 && $pos.node(depth).type.name !== "table") depth--;
  if (depth <= 0) return;
  const tableNode = $pos.node(depth);
  const tablePos = $pos.before(depth);
  const cells: number[] = [];
  tableNode.descendants((child, cpos) => {
    if (child.type.name === "tableCell" || child.type.name === "tableHeader") {
      // cpos 相对 table 节点起点（含 table 自身 1 偏移），tablePos + cpos 即 doc pos
      cells.push(tablePos + cpos);
    }
    return true;
  });
  if (cells.length === 0) return;
  const $a = state.doc.resolve(cells[0] + 1);
  const $b = state.doc.resolve(cells[cells.length - 1] + 1);
  editor.view.dispatch(state.tr.setSelection(new CellSelection($a, $b)));
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
