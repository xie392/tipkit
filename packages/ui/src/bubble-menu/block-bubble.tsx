"use client";

import { useCallback, useMemo } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ImageBlockActions } from "./block-actions/image-block-actions";
import { IframeActions } from "./block-actions/iframe-actions";
import { KatexActions } from "./block-actions/katex-actions";
import { AttachmentActions } from "./block-actions/attachment-actions";
import { ColumnsActions } from "./block-actions/columns-actions";
import { DetailsActions } from "./block-actions/details-actions";

/* 块级浮动工具栏（点击选中块触发，NodeSelection 驱动）。
 * hover 触发的操作栏由各 NodeView 内部渲染，包含复制/删除等通用操作。
 * 此处仅保留特定块类型独有的操作（如宽度、样式、重命名等），
 * 避免与 hover 工具栏中的复制/删除按钮重复。 */

const SPECIFIC_TYPES = new Set([
  "imageBlock",
  "iframe",
  "katex",
  "attachment",
  "columns",
  "details",
]);

interface SelectedBlock {
  typeName: string;
  pos: number;
  nodeSize: number;
  node: ProseMirrorNode;
}

function selectBlock(editor: Editor | null): SelectedBlock | null {
  if (!editor) return null;
  const sel = editor.state.selection;
  if (!(sel instanceof NodeSelection)) return null;
  return {
    typeName: sel.node.type.name,
    pos: sel.from,
    nodeSize: sel.node.nodeSize,
    node: sel.node,
  };
}

function renderSpecificActions(
  editor: Editor,
  node: ProseMirrorNode,
  pos: number,
  updateAttributes: (attrs: Record<string, unknown>) => void,
  deleteNode: () => void,
) {
  const props = { editor, node, pos, updateAttributes, deleteNode };
  switch (node.type.name) {
    case "imageBlock":
      return <ImageBlockActions {...props} />;
    case "iframe":
      return <IframeActions {...props} />;
    case "katex":
      return <KatexActions {...props} />;
    case "attachment":
      return <AttachmentActions {...props} />;
    case "columns":
      return <ColumnsActions {...props} />;
    case "details":
      return <DetailsActions {...props} />;
    default:
      return null;
  }
}

export function BlockBubbleMenu({ editor }: { editor: Editor | null }) {
  const selected = useEditorState({
    editor,
    selector: ({ editor: ed }) => selectBlock(ed),
  });

  const shouldShow = useCallback(
    ({ state, editor: ed }: { state: EditorState; editor: Editor }) => {
      if (!ed.isEditable) return false;
      const sel = state.selection;
      if (!(sel instanceof NodeSelection)) return false;
      return SPECIFIC_TYPES.has(sel.node.type.name);
    },
    [],
  );

  const options = useMemo(
    () => ({ placement: "top" as const, offset: 8 }),
    [],
  );

  if (!editor) return null;

  const updateAttributes = (typeName: string) => (attrs: Record<string, unknown>) => {
    editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes(typeName, attrs).run();
  };

  const deleteNode = (pos: number, nodeSize: number) => () => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .deleteRange({ from: pos, to: pos + nodeSize })
      .run();
  };

  let specificActions: React.ReactNode = null;
  if (selected) {
    const node = editor.state.doc.nodeAt(selected.pos);
    if (node) {
      specificActions = renderSpecificActions(
        editor,
        node,
        selected.pos,
        updateAttributes(selected.typeName),
        deleteNode(selected.pos, selected.nodeSize),
      );
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-block-bubble-menu"
      shouldShow={shouldShow}
      options={options}
      updateDelay={0}
      className="tk-block-bubble"
    >
      {specificActions && (
        <div className="tk-block-bubble-actions">{specificActions}</div>
      )}
    </BubbleMenu>
  );
}
