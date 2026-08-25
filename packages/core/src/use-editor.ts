import { useEffect } from "react";
import { useEditor, type Editor, type EditorOptions } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";

/**
 * TipKit 编辑器 hook —— 无头核心入口。
 *
 * 只组装 Tiptap 实例与轻量基础扩展，不做任何视觉输出。
 * 消费方通过 extensions 注入扩展集（推荐 createBasicExtensions() /
 * createAdvancedExtensions()，内含 StarterKit 与 History 插件）。
 *
 * 注意：此处不默认加 StarterKit——TipKitEditor 默认传入
 * createBasicExtensions()（含 StarterKit），若此处再加会导致
 * 两个 History 插件实例冲突（"Adding different instances of a keyed plugin"）。
 *
 * SSR 注意：Tiptap v3 的 useEditor 默认立即渲染，SSR 下必须
 * immediatelyRender: false，否则 hydration 报错。
 */
export interface UseTipKitEditorOptions {
  extensions?: EditorOptions["extensions"];
  content?: string | Record<string, unknown>;
  /** 初始内容类型；"markdown" 需已注入 @tiptap/markdown 扩展（类型由该包增强，core 侧只能收窄为字符串透传） */
  contentType?: "html" | "markdown" | "json";
  /** 单条占位符。多条随机提示语为 blog 自定义逻辑，M1 迁移时通过扩展实现 */
  placeholder?: string;
  onUpdate?: (editor: Editor) => void;
  onCreate?: (editor: Editor) => void;
  onSelectionUpdate?: (editor: Editor) => void;
  /** SSR 场景传 false（默认 false，与 Tiptap v3 默认值相反） */
  immediatelyRender?: boolean;
  editable?: boolean;
}

export function useTipKitEditor(options: UseTipKitEditorOptions) {
  // contentType 由 @tiptap/markdown 的模块增强声明，core 不直接依赖该包，故用独立类型片段透传（展开可绕过多余属性检查）
  const contentTypeOption = options.contentType
    ? { contentType: options.contentType }
    : {};

  const editor = useEditor({
    extensions: [
      Placeholder.configure({
        placeholder: options.placeholder ?? "Write something…",
      }),
      ...(options.extensions ?? []),
    ],
    content: options.content,
    ...contentTypeOption,
    editable: options.editable ?? true,
    immediatelyRender: options.immediatelyRender ?? false,
    editorProps: {
      attributes: {
        class: "tk-prosemirror",
      },
    },
    onUpdate: ({ editor }) => options.onUpdate?.(editor),
    onCreate: ({ editor }) => options.onCreate?.(editor),
    onSelectionUpdate: ({ editor }) => options.onSelectionUpdate?.(editor),
  });

  // Tiptap v3 的 useEditor 在选项更新时强制保留 editable（不会跟随 props 变化），
  // 这里用 setEditable 命令式同步，保证只读开关能实时生效。
  useEffect(() => {
    editor?.setEditable(options.editable ?? true);
  }, [editor, options.editable]);

  return editor;
}

export type { Editor };
