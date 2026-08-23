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
import { BlockTooltip } from "./block-actions/shared";

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

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
    ({ state }: { state: EditorState; editor: Editor }) => {
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

  const duplicate = (pos: number, nodeSize: number) => () => {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + nodeSize, node.toJSON())
      .run();
  };

  let specificActions: React.ReactNode = null;
  let typeName = "";
  if (selected) {
    typeName = selected.typeName;
    const node = editor.state.doc.nodeAt(selected.pos);
    if (node) {
      specificActions = renderSpecificActions(
        editor,
        node,
        selected.pos,
        updateAttributes(typeName),
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
        <>
          <div className="tk-block-bubble-actions">{specificActions}</div>
          <span className="tk-block-bubble-divider" />
        </>
      )}
      <BlockTooltip label="复制块">
        <button
          type="button"
          title="复制块"
          className="tk-block-bubble-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={selected ? duplicate(selected.pos, selected.nodeSize) : undefined}
        >
          <IconDuplicate />
        </button>
      </BlockTooltip>
      <BlockTooltip label="删除块">
        <button
          type="button"
          title="删除块"
          className="tk-block-bubble-btn is-danger"
          onMouseDown={(e) => e.preventDefault()}
          onClick={selected ? deleteNode(selected.pos, selected.nodeSize) : undefined}
        >
          <IconTrash />
        </button>
      </BlockTooltip>
    </BubbleMenu>
  );
}
