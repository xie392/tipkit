"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { Bold, Italic, Underline, Strikethrough, Code, Link, MessageSquare } from "lucide-react";
import { useT, useEditorDeps } from "@tipkit/core";

/* 选中文字浮层：选中非空文本时弹出工具条。
 * 可编辑态显示 格式化 + 链接 + 评论；只读态仅显示评论（阅读态也能划词评论，飞书/语雀模式）。
 * 视觉剥离：容器与按钮只带语义类名 tk-bubble-*，视觉由主题 CSS 提供。 */

function MenuBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      data-active={active || undefined}
      className="tk-bubble-btn"
    >
      {children}
    </button>
  );
}

export function TextMenu({ editor }: { editor: Editor | null }) {
  const t = useT();
  const deps = useEditorDeps();
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | Window | undefined>(undefined);

  useEffect(() => {
    if (!editor) return;
    let el: HTMLElement | null = editor.view.dom.parentElement;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        setScrollTarget(el);
        return;
      }
      el = el.parentElement;
    }
    setScrollTarget(window);
  }, [editor]);

  const states = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      return {
        isEditable: ed.isEditable,
        isBold: ed.isActive("bold"),
        isItalic: ed.isActive("italic"),
        isUnderline: ed.isActive("underline"),
        isStrike: ed.isActive("strike"),
        isCode: ed.isActive("code"),
        isLink: ed.isActive("link"),
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: { state: Editor["state"] }) => {
      if (!editor) return false;
      const sel = state.selection;
      if (sel.empty) return false;
      if (sel instanceof NodeSelection) return false;
      if (sel instanceof CellSelection) return false;
      const { $from, $to } = sel;
      if ($from.parent.type.name === "codeBlock" || $to.parent.type.name === "codeBlock") {
        return false;
      }
      // 只读模式下：只有当注册了 comment mark 时才显示（只读仅支持评论，不支持格式化）
      if (!editor.isEditable) {
        return !!editor.schema.marks.comment;
      }
      const { from, to } = sel;
      const text = state.doc.textBetween(from, to, "\n", "\n").trim();
      return text.length > 0;
    },
    [editor],
  );

  const bubbleOptions = useMemo(
    () => ({ placement: "top" as const, offset: 8, scrollTarget }),
    [scrollTarget],
  );

  const triggerComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");
    const commentId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // readonly 下 chain().focus() 会被 can() 短路，直接调命令
    (editor.commands as unknown as { setComment: (id: string) => boolean }).setComment(commentId);
    deps.onCommentCreate?.({ from, to, text, commentId });
  }, [editor, deps]);

  if (!editor || !states) return null;

  const chain = () => editor.chain().focus();
  const isEditable = states.isEditable;
  const showCommentBtn = !!editor.schema.marks.comment;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-text-menu"
      shouldShow={shouldShow}
      options={bubbleOptions}
      updateDelay={120}
    >
      <div className="tk-bubble-menu">
        {isEditable && (
          <>
            <MenuBtn title={`${t("text.bold")} ⌘B`} active={states.isBold} onClick={() => chain().toggleBold().run()}>
              <Bold className="tk-icon-md" />
            </MenuBtn>
            <MenuBtn title={`${t("text.italic")} ⌘I`} active={states.isItalic} onClick={() => chain().toggleItalic().run()}>
              <Italic className="tk-icon-md" />
            </MenuBtn>
            <MenuBtn
              title={`${t("text.underline")} ⌘U`}
              active={states.isUnderline}
              onClick={() => chain().toggleUnderline().run()}
            >
              <Underline className="tk-icon-md" />
            </MenuBtn>
            <MenuBtn
              title={t("text.strike")}
              active={states.isStrike}
              onClick={() => chain().toggleStrike().run()}
            >
              <Strikethrough className="tk-icon-md" />
            </MenuBtn>
            <MenuBtn title={t("text.code")} active={states.isCode} onClick={() => chain().toggleCode().run()}>
              <Code className="tk-icon-md" />
            </MenuBtn>

            <span className="tk-bubble-divider" />

            <MenuBtn
              title={`${t("text.link")} ⌘K`}
              active={states.isLink}
              onClick={() => {
                const href = window.prompt(t("toolbar.linkPrompt"));
                if (href) chain().setLink({ href }).run();
              }}
            >
              <Link className="tk-icon-md" />
            </MenuBtn>
          </>
        )}

        {showCommentBtn && (
          <>
            {isEditable && <span className="tk-bubble-divider" />}
            <MenuBtn title={t("text.comment")} onClick={triggerComment}>
              <MessageSquare className="tk-icon-md" />
            </MenuBtn>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
