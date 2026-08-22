"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mergeAttributes, Node as TiptapNode, wrappingInputRule } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import { emojisToName } from "../emoji/emoji-data";

/* Callout 提示框（迁移自 blog rich-text/ext/callout.tsx）。
 * 预设 5 种风格；属性 variant / emoji；内容由 NodeViewContent 承载。 */

export type CalloutVariant = "info" | "success" | "warning" | "danger" | "note";

interface CalloutStyle {
  label: string;
  emoji: string;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}

export const CALLOUT_VARIANTS: Record<CalloutVariant, CalloutStyle> = {
  info: {
    label: "信息",
    emoji: "💡",
    textColor: "#1e40af",
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  success: {
    label: "成功",
    emoji: "✅",
    textColor: "#166534",
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  warning: {
    label: "警告",
    emoji: "⚠️",
    textColor: "#854d0e",
    borderColor: "#fcd34d",
    backgroundColor: "#fefce8",
  },
  danger: {
    label: "危险",
    emoji: "🔥",
    textColor: "#991b1b",
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  note: {
    label: "备注",
    emoji: "📝",
    textColor: "#3f3f46",
    borderColor: "#d4d4d8",
    backgroundColor: "#f4f4f5",
  },
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
      setCalloutVariant: (variant: CalloutVariant) => ReturnType;
      setCalloutEmoji: (emoji: string) => ReturnType;
    };
  }
}

export const Callout = TiptapNode.create({
  name: "callout",
  content: "paragraph+",
  group: "block",
  defining: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-callout" } };
  },

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-variant") ?? "info",
        renderHTML: (a) => ({ "data-variant": a.variant }),
      },
      emoji: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-emoji") ?? null,
        renderHTML: (a) => (a.emoji ? { "data-emoji": a.emoji } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-callout" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const variant = (attrs["data-variant"] as CalloutVariant) ?? "info";
    const style = CALLOUT_VARIANTS[variant] ?? CALLOUT_VARIANTS.info;
    const emoji = (attrs["data-emoji"] as string) ?? style.emoji;
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-variant": variant,
        "data-emoji": emoji,
        style: `color:${style.textColor};border-color:${style.borderColor};background:${style.backgroundColor}`,
      }),
      ["div", { class: "tk-callout-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands, state }) => {
          const { selection } = state;
          if (selection.empty) {
            return commands.insertContent({
              type: "callout",
              attrs: { variant: "info" },
              content: [{ type: "paragraph" }],
            });
          }
          return commands.toggleWrap("callout");
        },
      setCalloutVariant:
        (variant) =>
        ({ commands }) =>
          commands.updateAttributes("callout", { variant }),
      setCalloutEmoji:
        (emoji) =>
        ({ commands }) =>
          commands.updateAttributes("callout", { emoji }),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^>!$/,
        type: this.type,
        getAttributes: () => ({ variant: "info" }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

function CalloutView(props: NodeViewProps) {
  const { editor, node, updateAttributes } = props;
  const attrs = node.attrs as { variant: CalloutVariant; emoji: string | null };
  const variant = attrs.variant ?? "info";
  const style = CALLOUT_VARIANTS[variant] ?? CALLOUT_VARIANTS.info;
  const emoji = attrs.emoji ?? style.emoji;

  const [variantOpen, setVariantOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!variantOpen && !emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setVariantOpen(false);
        setEmojiOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVariantOpen(false);
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [variantOpen, emojiOpen]);

  const filteredEmojis = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    return q ? emojisToName.filter((e) => e.name.includes(q)).slice(0, 60) : emojisToName.slice(0, 60);
  }, [emojiQuery]);

  const pickEmoji = (e: string) => {
    updateAttributes({ emoji: e });
    setEmojiOpen(false);
    setEmojiQuery("");
  };

  return (
    <NodeViewWrapper ref={wrapRef} className={`tk-callout tk-callout-${variant}`}>
      <div className="tk-callout-head">
        <button
          type="button"
          className="tk-callout-emoji"
          title="更换图标"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setEmojiOpen((v) => !v);
            setVariantOpen(false);
          }}
        >
          {emoji}
        </button>
        {emojiOpen && (
          <div className="tk-callout-emoji-panel" contentEditable={false}>
            <input
              ref={emojiInputRef}
              autoFocus
              value={emojiQuery}
              onChange={(e) => setEmojiQuery(e.target.value)}
              placeholder="搜索 emoji…"
              className="tk-callout-emoji-search"
            />
            <div className="tk-callout-emoji-grid">
              {filteredEmojis.length === 0 ? (
                <div className="tk-callout-emoji-empty">没有匹配</div>
              ) : (
                filteredEmojis.map((it) => (
                  <button
                    key={it.name}
                    type="button"
                    title={`:${it.name}:`}
                    onClick={() => pickEmoji(it.emoji)}
                    className="tk-callout-emoji-cell"
                  >
                    {it.emoji}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <NodeViewContent className="tk-callout-content" />
      {editor.isEditable && (
        <div className="tk-callout-switcher">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setVariantOpen((v) => !v)}
            className="tk-callout-switcher-btn"
            title="切换风格"
          >
            {style.label} ▾
          </button>
          {variantOpen && (
            <div className="tk-callout-variant-panel">
              {(Object.keys(CALLOUT_VARIANTS) as CalloutVariant[]).map((v) => {
                const s = CALLOUT_VARIANTS[v];
                return (
                  <button
                    key={v}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      updateAttributes({ variant: v });
                      setVariantOpen(false);
                    }}
                    className={`tk-callout-variant-cell${v === variant ? " is-active" : ""}`}
                    style={{
                      color: s.textColor,
                      borderColor: s.borderColor,
                      background: s.backgroundColor,
                    }}
                  >
                    <span>{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default Callout;
