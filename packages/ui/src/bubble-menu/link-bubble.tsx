"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Pencil, ExternalLink, Unlink } from "lucide-react";
import { useT } from "@tipkit/core";
import { openLinkDialog } from "./link-dialog";

/* 链接气泡（迁移自 blog rich-text/link-bubble.tsx）：
 * 选中/点击链接时显示编辑小工具条。视觉走主题（tk-bubble-*）。 */

function BubbleBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="tk-bubble-btn"
    >
      {children}
    </button>
  );
}

export function LinkBubble({ editor }: { editor: Editor | null }) {
  const t = useT();
  const href =
    useEditorState({
      editor,
      selector: ({ editor: ed }) =>
        ed ? ((ed.getAttributes("link").href as string) ?? "") : "",
    }) ?? "";

  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-link-bubble-menu"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: currentEditor }) =>
        currentEditor.isEditable && currentEditor.isActive("link")
      }
      className="tk-bubble-menu"
    >
      <span className="tk-bubble-href">{href}</span>
      <span className="tk-bubble-divider" />
      <BubbleBtn title={t("link.edit")} onClick={() => openLinkDialog()}>
        <Pencil className="tk-icon-sm" />
      </BubbleBtn>
      <BubbleBtn
        title={t("link.open")}
        onClick={() => {
          if (href) window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        <ExternalLink className="tk-icon-sm" />
      </BubbleBtn>
      <BubbleBtn
        title={t("link.unlink")}
        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
      >
        <Unlink className="tk-icon-sm" />
      </BubbleBtn>
    </BubbleMenu>
  );
}
