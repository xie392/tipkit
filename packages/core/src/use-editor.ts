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
  const editor = useEditor({
    extensions: [
      Placeholder.configure({
        placeholder: options.placeholder ?? "写下点什么…",
      }),
      ...(options.extensions ?? []),
    ],
    content: options.content,
    // 注意：tiptap 的 mergeDeep 会用 undefined 覆盖默认值（editable 默认 true），
    // 必须兜底为 true，否则编辑器会变成只读（TaskItem 勾选等交互失效）
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

  return editor;
}

export type { Editor };
