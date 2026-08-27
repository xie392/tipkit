"use client";

import { useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { EditorProvider, useTipKitEditor } from "@tipkit/core";
import type { EditorDeps, ToolbarAction, ToolbarGroup, IconRef, Translate } from "@tipkit/core";
import { createBasicExtensions } from "@tipkit/extensions";

/**
 * TipKit 复合编辑器组件 —— 聚合入口。
 *
 * 组装：依赖注入（EditorProvider）+ 编辑器实例（useTipKitEditor，默认基础扩展）+ 内容区。
 * 工具栏/浮层不在此渲染（它们属于主题层），通过 props 插槽由消费方注入：
 *
 * ```tsx
 * <TipKitEditor deps={deps}>
 *   {(editor) => <MyToolbar groups={buildToolbarGroups(editor, t)} />}
 * </TipKitEditor>
 * ```
 */
/** 原生 NodeView 读取注入 i18n 的扩展接口（TipKitEditor 挂载 __tipkitT） */
export type TipKitEditorInstance = Editor & { __tipkitT?: Translate };

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
  /** 只读渲染（文档/预览场景） */
  editable?: boolean;
  /** 初始 content 的格式；"markdown" 时 content 传 md 字符串 */
  contentType?: "html" | "markdown" | "json";
  className?: string;
  children?: React.ReactNode | ((editor: Editor | null) => React.ReactNode);
}

export function TipKitEditor({
  deps,
  extensions,
  content,
  contentType,
  placeholder,
  onChange,
  onCreate,
  immediatelyRender,
  editable,
  className,
  children,
}: TipKitEditorProps) {
  const editor = useTipKitEditor({
    extensions: extensions === undefined ? createBasicExtensions() : extensions,
    content,
    contentType,
    placeholder,
    onUpdate: onChange,
    // 编辑器初始化（NodeView 创建前）就挂上注入的 i18n
    onCreate: (e) => {
      (e as TipKitEditorInstance).__tipkitT = deps.t;
      onCreate?.(e);
    },
    immediatelyRender,
    editable,
  });

  // 原生 NodeView（如折叠块 details）无法用 React context 读 deps，
  // 这里把注入的 t 挂到 editor 实例供其读取，保持 i18n 单一来源。
  // 语言切换时同步更新，并派发 tipkit:langChange 事件，原生 NodeView 监听后刷新 tooltip 等文案。
  useEffect(() => {
    if (!editor) return;
    (editor as TipKitEditorInstance).__tipkitT = deps.t;
    if (editor.view?.dom) {
      editor.view.dom.dispatchEvent(new CustomEvent("tipkit:langChange"));
    }
  }, [editor, deps.t]);

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

/** 由 editor 计算基础工具栏分组。视觉渲染交给主题/消费方。
 *  t 为 i18n 翻译函数（来自 useT()），不传时 key 原样返回。 */
export function buildToolbarGroups(editor: Editor | null, t?: Translate): ToolbarGroup[] {
  editorRef.current = editor;
  if (!editor) return [];

  const tr = t ?? ((k: string) => k);

  const groups: ToolbarGroup[] = [
    {
      id: "history",
      actions: [
        {
          type: "button",
          id: "undo",
          label: tr("toolbar.undo"),
          icon: "Undo2",
          onExecute: (e) => e.chain().focus().undo().run(),
        },
        {
          type: "button",
          id: "redo",
          label: tr("toolbar.redo"),
          icon: "Redo2",
          onExecute: (e) => e.chain().focus().redo().run(),
        },
      ],
    },
    {
      id: "marks",
      actions: [
        markAction("bold", tr("toolbar.bold"), "Bold", (e) => e.isActive("bold"), (e) => e.chain().focus().toggleBold().run()),
        markAction("italic", tr("toolbar.italic"), "Italic", (e) => e.isActive("italic"), (e) => e.chain().focus().toggleItalic().run()),
        markAction("strike", tr("toolbar.strike"), "Strikethrough", (e) => e.isActive("strike"), (e) => e.chain().focus().toggleStrike().run()),
        markAction("underline", tr("toolbar.underline"), "Underline", (e) => e.isActive("underline"), (e) => e.chain().focus().toggleUnderline().run()),
        markAction("code", tr("toolbar.code"), "Code", (e) => e.isActive("code"), (e) => e.chain().focus().toggleCode().run()),
        markAction("highlight", tr("toolbar.highlight"), "Highlighter", (e) => e.isActive("highlight"), (e) => e.chain().focus().toggleHighlight().run()),
        {
          type: "select",
          id: "color",
          label: tr("toolbar.textColor"),
          icon: "Palette",
          options: [
            { id: "default", label: tr("toolbar.colorDefault"), onSelect: (e) => e.chain().focus().unsetColor().run() },
            { id: "red", label: tr("toolbar.colorRed"), onSelect: (e) => e.chain().focus().setColor("#e4572e").run() },
            { id: "blue", label: tr("toolbar.colorBlue"), onSelect: (e) => e.chain().focus().setColor("#3b82f6").run() },
            { id: "green", label: tr("toolbar.colorGreen"), onSelect: (e) => e.chain().focus().setColor("#22c55e").run() },
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
          label: tr("toolbar.heading"),
          icon: "Heading1",
          options: [
            { id: "p", label: tr("toolbar.paragraph"), onSelect: (e) => e.chain().focus().setParagraph().run() },
            { id: "h1", label: tr("toolbar.heading1"), onSelect: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
            { id: "h2", label: tr("toolbar.heading2"), onSelect: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
            { id: "h3", label: tr("toolbar.heading3"), onSelect: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
          ],
        },
        markAction("bulletList", tr("toolbar.bulletList"), "List", (e) => e.isActive("bulletList"), (e) => e.chain().focus().toggleBulletList().run()),
        markAction("orderedList", tr("toolbar.orderedList"), "ListOrdered", (e) => e.isActive("orderedList"), (e) => e.chain().focus().toggleOrderedList().run()),
        markAction("taskList", tr("toolbar.taskList"), "ListChecks", (e) => e.isActive("taskList"), (e) => e.chain().focus().toggleTaskList().run()),
        markAction("blockquote", tr("toolbar.blockquote"), "Quote", (e) => e.isActive("blockquote"), (e) => e.chain().focus().toggleBlockquote().run()),
        markAction("codeBlock", tr("toolbar.codeBlock"), "Code2", (e) => e.isActive("codeBlock"), (e) => e.chain().focus().toggleCodeBlock().run()),
        {
          type: "button",
          id: "insertTable",
          label: tr("toolbar.insertTable"),
          icon: "Table2",
          onExecute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
      ],
    },
    {
      id: "align",
      actions: [
        markAction("alignLeft", tr("toolbar.alignLeft"), "AlignLeft", (e) => e.isActive({ textAlign: "left" }), (e) => e.chain().focus().setTextAlign("left").run()),
        markAction("alignCenter", tr("toolbar.alignCenter"), "AlignCenter", (e) => e.isActive({ textAlign: "center" }), (e) => e.chain().focus().setTextAlign("center").run()),
        markAction("alignRight", tr("toolbar.alignRight"), "AlignRight", (e) => e.isActive({ textAlign: "right" }), (e) => e.chain().focus().setTextAlign("right").run()),
        markAction("alignJustify", tr("toolbar.alignJustify"), "AlignJustify", (e) => e.isActive({ textAlign: "justify" }), (e) => e.chain().focus().setTextAlign("justify").run()),
      ],
    },
    {
      id: "insert",
      actions: [
        {
          type: "button",
          id: "link",
          label: tr("toolbar.insertLink"),
          icon: "Link",
          isEnabled: () => !editor.state.selection.empty,
          onExecute: (e) => {
            const href = window.prompt(tr("toolbar.linkPrompt"));
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
