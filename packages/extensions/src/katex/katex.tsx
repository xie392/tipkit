"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useT, useEditorEditable } from "@tipkit/core";
import katex from "katex";
import "katex/dist/katex.min.css";

/* Katex 数学公式（迁移自 blog rich-text/ext/katex.tsx）。
 * 客户端用 katex 渲染（SSR 场景消费方可通过 EditorDeps.renderKatex 注入服务端渲染）。
 * 类名 tk-*，视觉归主题。 */

export interface KatexAttrs {
  text: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    katex: {
      setKatex: (attrs?: Partial<KatexAttrs>) => ReturnType;
    };
  }
}

export const Katex = Node.create({
  name: "katex",
  group: "block",
  selectable: true,
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-katex" } };
  },

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-text") ?? "",
        renderHTML: (a) => ({ "data-text": a.text }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-katex" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-text": (HTMLAttributes as Record<string, unknown>)["data-text"] ?? "",
      }),
    ];
  },

  addCommands() {
    return {
      setKatex:
        (attrs) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({ type: "katex", attrs: { text: attrs?.text ?? "" } })
            .run(),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$katex\$\$$/,
        type: this.type,
        getAttributes: () => ({ text: "" }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KatexView);
  },
});

function KatexView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected } = props;
  const attrs = node.attrs as KatexAttrs;
  const text = attrs.text ?? "";
  const isEditable = useEditorEditable(editor);
  const t = useT();
  const [editing, setEditing] = useState(!text.trim());
  const [draft, setDraft] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditable) setEditing(false);
  }, [isEditable]);

  useEffect(() => {
    if (editing) {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  const html = useMemo(() => {
    if (!text.trim()) return "";
    try {
      return katex.renderToString(text, {
        throwOnError: false,
        displayMode: true,
        output: "html",
      });
    } catch {
      return `<span style="color:#dc2626">${t("katex.renderError")}${text}</span>`;
    }
  }, [text, t]);

  const openEditor = () => {
    setDraft(text);
    setEditing(true);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    });
  };
  const commit = () => {
    updateAttributes({ text: draft });
    setEditing(false);
  };

  return (
    <NodeViewWrapper
      className={`tk-katex${selected ? " is-selected" : ""}`}
      data-empty={!text.trim() ? "true" : "false"}
      contentEditable={false}
    >
      {editing ? (
        <div className="tk-katex-editor">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            }}
            placeholder={t("katex.placeholder")}
            className="tk-katex-textarea"
            rows={3}
          />
          <div className="tk-katex-editor-actions">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEditing(false)}
              className="tk-katex-btn"
            >
              {t("katex.cancel")}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commit}
              className="tk-katex-btn tk-katex-btn-primary"
            >
              {t("katex.save")}
            </button>
          </div>
        </div>
      ) : (
        <div className="tk-katex-display" onDoubleClick={isEditable ? openEditor : undefined}>
          {text.trim() ? (
            <span dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openEditor}
              className="tk-katex-placeholder"
            >
              {t("katex.emptyPlaceholder")}
            </button>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default Katex;
