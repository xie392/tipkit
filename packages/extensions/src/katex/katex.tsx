"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useT, useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";
import { Copy, Check } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* Katex 数学公式（迁移自 blog rich-text/ext/katex.tsx）。
 * 客户端用 katex 渲染（SSR 场景消费方可通过 EditorDeps.renderKatex 注入服务端渲染）。
 * 类名 tk-*，视觉归主题。
 * 注：块级操作（编辑/复制块/删除块）已统一由 BlockBubbleMenu 承载，本组件
 * 不再渲染右上角 hover 工具栏；只读模式下保留一个"复制公式源码"按钮。 */

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
  const { node, updateAttributes, deleteNode } = props;
  const attrs = node.attrs as KatexAttrs;
  const text = attrs.text ?? "";
  const isEditable = useEditorEditable(props.editor);
  const t = useT();
  const [editing, setEditing] = useState(!text.trim());
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placement = useToolbarPlacement(wrapperRef);
  const { visible, show, hide } = useToolbarVisibility();

  useEffect(() => {
    if (!isEditable) setEditing(false);
  }, [isEditable]);

  const openEditor = useCallback(() => {
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
  }, [text]);

  // 监听外部（BlockBubbleMenu 的 KatexActions）发起的"打开编辑器"事件
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.stopPropagation();
      if (isEditable) openEditor();
    };
    el.addEventListener("tk-katex:open-editor", handler);
    return () => el.removeEventListener("tk-katex:open-editor", handler);
  }, [isEditable, openEditor]);

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

  const commit = () => {
    updateAttributes({ text: draft });
    setEditing(false);
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`tk-katex tk-hover-toolbar${isEditable ? " is-editable" : " is-readonly"}${hovered ? " is-hovered" : ""}${props.selected ? " is-selected" : ""}`}
      data-empty={!text.trim() ? "true" : "false"}
      contentEditable={false}
      onMouseEnter={() => {
        setHovered(true);
        show();
      }}
      onMouseLeave={() => {
        setHovered(false);
        hide();
      }}
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
        <>
          {/* 编辑模式：hover 工具栏（通过桥接区避免间隙导致消失，随滚动翻转） */}
          {isEditable && text.trim() && (
            <div
              className={`tk-ct-toolbar-bridge ${placement === "bottom" ? "is-bottom" : "is-top"}${visible ? " is-visible" : ""}`}
              contentEditable={false}
              onMouseEnter={show}
              onMouseLeave={hide}
            >
              <div className="tk-ct-toolbar">
                <button
                  type="button"
                  className="tk-ct-btn"
                  data-tip={t("katex.edit")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openEditor}
                >
                  <IconEdit />
                </button>
                <span className="tk-ct-sep" />
                <button
                  type="button"
                  className="tk-ct-btn"
                  data-tip={t("katex.copySource")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={copySource}
                >
                  <IconCopy />
                </button>
                <span className="tk-ct-sep" />
                <button
                  type="button"
                  className="tk-ct-btn"
                  data-tip={t("block.delete")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => deleteNode()}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          )}
          <div className="tk-katex-display" onDoubleClick={isEditable ? openEditor : undefined}>
            {/* 只读模式：显示复制公式源码按钮 */}
            {!isEditable && text.trim() && (
              <button
                type="button"
                className="tk-katex-copy-btn"
                aria-label={copied ? t("codeBlock.copied") : t("katex.copySource")}
                title={copied ? t("codeBlock.copied") : t("katex.copySource")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={copySource}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            {text.trim() ? (
              <span dangerouslySetInnerHTML={{ __html: html }} />
            ) : isEditable ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openEditor}
                className="tk-katex-placeholder"
              >
                {t("katex.emptyPlaceholder")}
              </button>
            ) : null}
          </div>
        </>
      )}
    </NodeViewWrapper>
  );
}

export default Katex;

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2l-8 8L2 12.5l.5-3.5 8-8z" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}

