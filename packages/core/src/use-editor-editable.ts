"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

/**
 * 响应式读取 editor.isEditable。
 *
 * 背景：`editor.isEditable` 是 Tiptap 实例上的 getter，本身不触发 React 重渲染。
 * `editor.setEditable()` 虽然会 emit `update` 事件，但 ReactNodeView 内部用 `memo()`
 * 包裹、且 node 引用未变时不会 re-render，导致只读切换后各 NodeView 里的编辑按钮
 * 仍按初始值（可编辑）显示。本 hook 通过订阅 `update` 事件同步最新值，确保只读切换时
 * 组件能正确隐藏/禁用编辑控件。
 */
export function useEditorEditable(editor: Editor | null | undefined): boolean {
  const [editable, setEditable] = useState<boolean>(() => !!editor?.isEditable);

  useEffect(() => {
    if (!editor) {
      setEditable(false);
      return;
    }
    setEditable(editor.isEditable);
    const onUpdate = () => {
      setEditable((prev) => (prev === editor.isEditable ? prev : editor.isEditable));
    };
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
    };
  }, [editor]);

  return editable;
}
