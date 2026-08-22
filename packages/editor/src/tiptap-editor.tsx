"use client";

import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { EditorProvider, useTipKitEditor } from "@tipkit/core";
import type { EditorDeps, ToolbarAction, ToolbarGroup, IconRef } from "@tipkit/core";
import { createBasicExtensions } from "@tipkit/extensions";

/**
 * TipKit 复合编辑器组件 —— 聚合入口。
 *
 * 组装：依赖注入（EditorProvider）+ 编辑器实例（useTipKitEditor，默认基础扩展）+ 内容区。
 * 工具栏/浮层不在此渲染（它们属于主题层），通过 props 插槽由消费方注入：
 *
 * ```tsx
 * <TipKitEditor deps={deps}>
 *   {(editor) => <MyToolbar groups={buildToolbarGroups(editor)} />}
 * </TipKitEditor>
 * ```
 */
export interface TipKitEditorProps {
  deps: EditorDeps;
  /** 追加扩展（在基础集合之上）；传 [] 可禁用基础集合 */
  extensions?: Parameters<typeof useTipKitEditor>[0]["extensions"];
  content?: string | Record<string, unknown>;
  placeholder?: string;
  onChange?: (editor: Editor) => void;
  onCreate?: (editor: Editor) => void;
  /** SSR 场景传 false（默认 false） */
  immediatelyRender?: boolean;
  className?: string;
  children?: React.ReactNode | ((editor: Editor | null) => React.ReactNode);
}

export function TipKitEditor({
  deps,
  extensions,
  content,
  placeholder,
  onChange,
  onCreate,
  immediatelyRender,
  className,
  children,
}: TipKitEditorProps) {
  const editor = useTipKitEditor({
    extensions: extensions === undefined ? createBasicExtensions() : extensions,
    content,
    placeholder,
    onUpdate: onChange,
    onCreate,
    immediatelyRender,
  });

  return (
    <EditorProvider deps={deps}>
      <div className={className}>
        {typeof children === "function" ? children(editor) : children}
        <div className="tk-editor">
          <EditorContent editor={editor} />
        </div>
      </div>
    </EditorProvider>
  );
}

/* ------------------------------------------------------------------ */
/* 工具栏分组（逻辑层，视觉由主题渲染）                                  */
/* ------------------------------------------------------------------ */

// buildToolbarGroups 在 render 中调用，保存当前实例供 isActive/isEnabled 使用
let editorRef: { current: Editor | null } = { current: null };

/** 由 editor 计算基础工具栏分组。视觉渲染交给主题/消费方。 */
export function buildToolbarGroups(editor: Editor | null): ToolbarGroup[] {
  editorRef.current = editor;
  if (!editor) return [];

  const groups: ToolbarGroup[] = [
    {
      id: "history",
      actions: [
        {
          type: "button",
          id: "undo",
          label: "撤销",
          icon: "Undo2",
          onExecute: (e) => e.chain().focus().undo().run(),
        },
        {
          type: "button",
          id: "redo",
          label: "重做",
          icon: "Redo2",
          onExecute: (e) => e.chain().focus().redo().run(),
        },
      ],
    },
    {
      id: "marks",
      actions: [
        markAction("bold", "加粗", "Bold", (e) => e.isActive("bold"), (e) => e.chain().focus().toggleBold().run()),
        markAction("italic", "斜体", "Italic", (e) => e.isActive("italic"), (e) => e.chain().focus().toggleItalic().run()),
        markAction("strike", "删除线", "Strikethrough", (e) => e.isActive("strike"), (e) => e.chain().focus().toggleStrike().run()),
        markAction("underline", "下划线", "Underline", (e) => e.isActive("underline"), (e) => e.chain().focus().toggleUnderline().run()),
        markAction("code", "行内代码", "Code", (e) => e.isActive("code"), (e) => e.chain().focus().toggleCode().run()),
        markAction("highlight", "高亮", "Highlighter", (e) => e.isActive("highlight"), (e) => e.chain().focus().toggleHighlight().run()),
        {
          type: "select",
          id: "color",
          label: "文字颜色",
          icon: "Palette",
          options: [
            { id: "default", label: "默认色", onSelect: (e) => e.chain().focus().unsetColor().run() },
            { id: "red", label: "红", onSelect: (e) => e.chain().focus().setColor("#e4572e").run() },
            { id: "blue", label: "蓝", onSelect: (e) => e.chain().focus().setColor("#3b82f6").run() },
            { id: "green", label: "绿", onSelect: (e) => e.chain().focus().setColor("#22c55e").run() },
          ],
        },
      ],
    },
    {
      id: "blocks",
      actions: [
        {
          type: "select",
          id: "heading",
          label: "标题",
          icon: "Heading1",
          options: [
            { id: "p", label: "正文", onSelect: (e) => e.chain().focus().setParagraph().run() },
            { id: "h1", label: "标题 1", onSelect: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
            { id: "h2", label: "标题 2", onSelect: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
            { id: "h3", label: "标题 3", onSelect: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
          ],
        },
        markAction("bulletList", "无序列表", "List", (e) => e.isActive("bulletList"), (e) => e.chain().focus().toggleBulletList().run()),
        markAction("orderedList", "有序列表", "ListOrdered", (e) => e.isActive("orderedList"), (e) => e.chain().focus().toggleOrderedList().run()),
        markAction("taskList", "任务列表", "ListChecks", (e) => e.isActive("taskList"), (e) => e.chain().focus().toggleTaskList().run()),
        markAction("blockquote", "引用", "Quote", (e) => e.isActive("blockquote"), (e) => e.chain().focus().toggleBlockquote().run()),
        markAction("codeBlock", "代码块", "Code2", (e) => e.isActive("codeBlock"), (e) => e.chain().focus().toggleCodeBlock().run()),
        {
          type: "button",
          id: "insertTable",
          label: "插入表格",
          icon: "Table2",
          onExecute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
      ],
    },
    {
      id: "align",
      actions: [
        markAction("alignLeft", "左对齐", "AlignLeft", (e) => e.isActive({ textAlign: "left" }), (e) => e.chain().focus().setTextAlign("left").run()),
        markAction("alignCenter", "居中", "AlignCenter", (e) => e.isActive({ textAlign: "center" }), (e) => e.chain().focus().setTextAlign("center").run()),
        markAction("alignRight", "右对齐", "AlignRight", (e) => e.isActive({ textAlign: "right" }), (e) => e.chain().focus().setTextAlign("right").run()),
        markAction("alignJustify", "两端对齐", "AlignJustify", (e) => e.isActive({ textAlign: "justify" }), (e) => e.chain().focus().setTextAlign("justify").run()),
      ],
    },
    {
      id: "insert",
      actions: [
        {
          type: "button",
          id: "link",
          label: "插入链接",
          icon: "Link",
          isEnabled: () => !editor.state.selection.empty,
          onExecute: (e) => {
            const href = window.prompt("链接地址（https://…）");
            if (!href) return;
            e.chain().focus().setLink({ href }).run();
          },
        },
        { type: "divider", id: "divider", label: "" },
      ],
    },
  ];

  return groups;
}

function markAction(
  id: string,
  label: string,
  icon: IconRef,
  isActive: (e: Editor) => boolean,
  onExecute: (e: Editor) => void,
): ToolbarAction {
  return {
    type: "button",
    id,
    label,
    icon,
    isActive: () => isActive(editorRef.current as Editor),
    isEnabled: () => !!editorRef.current,
    onExecute,
  };
}

export type { ToolbarAction, ToolbarGroup };
