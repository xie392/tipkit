"use client";

import { useCallback } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";

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

export function BlockBubbleMenu({ editor }: { editor: Editor }) {
  const shouldShow = useCallback(
    ({ state }: { state: Editor["state"] }) => {
      if (!editor.isEditable) return false;
      const sel = state.selection;
      if (!(sel instanceof NodeSelection)) return false;
      const name = sel.node.type.name;
      return name !== "table";
    },
    [editor],
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-block-bubble"
      shouldShow={shouldShow}
      options={{ placement: "top", offset: 8 }}
      updateDelay={50}
    >
      <div className="tk-block-bubble">
        <button
          type="button"
          title="复制块"
          className="tk-block-bubble-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const { selection } = editor.state;
            if (!(selection instanceof NodeSelection)) return;
            editor
              .chain()
              .focus()
              .insertContentAt(selection.to, selection.node.toJSON())
              .run();
          }}
        >
          <IconDuplicate />
        </button>
        <span className="tk-block-bubble-divider" />
        <button
          type="button"
          title="删除块"
          className="tk-block-bubble-btn is-danger"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          <IconTrash />
        </button>
      </div>
    </BubbleMenu>
  );
}
