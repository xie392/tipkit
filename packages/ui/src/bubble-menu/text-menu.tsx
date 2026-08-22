"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { Bold, Italic, Underline, Strikethrough, Code, Link } from "lucide-react";

/* 选中文字浮层（迁移自 blog rich-text/text-menu.tsx）：
 * 选中非空文本时弹出加粗/斜体/下划线/删除线/行内代码/链接工具条。
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
      if (!editor?.isEditable) return false;
      const sel = state.selection;
      if (sel.empty) return false;
      if (sel instanceof NodeSelection) return false;
      if (sel instanceof CellSelection) return false;
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

  if (!editor || !states) return null;

  const chain = () => editor.chain().focus();

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-text-menu"
      shouldShow={shouldShow}
      options={bubbleOptions}
      updateDelay={120}
    >
      <div className="tk-bubble-menu">
        <MenuBtn title="加粗 ⌘B" active={states.isBold} onClick={() => chain().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </MenuBtn>
        <MenuBtn title="斜体 ⌘I" active={states.isItalic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </MenuBtn>
        <MenuBtn
          title="下划线 ⌘U"
          active={states.isUnderline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </MenuBtn>
        <MenuBtn
          title="删除线"
          active={states.isStrike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </MenuBtn>
        <MenuBtn title="行内代码" active={states.isCode} onClick={() => chain().toggleCode().run()}>
          <Code className="h-4 w-4" />
        </MenuBtn>

        <span className="tk-bubble-divider" />

        <MenuBtn
          title="链接 ⌘K"
          active={states.isLink}
          onClick={() => {
            const href = window.prompt("链接地址（https://…）");
            if (href) chain().setLink({ href }).run();
          }}
        >
          <Link className="h-4 w-4" />
        </MenuBtn>
      </div>
    </BubbleMenu>
  );
}
