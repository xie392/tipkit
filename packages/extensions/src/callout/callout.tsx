"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mergeAttributes, Node as TiptapNode, wrappingInputRule } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import { useT } from "@tipkit/core";
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
  draggable: true,
  selectable: false,

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
          const isEmptyParagraphNodeSelection =
            selection instanceof NodeSelection &&
            selection.node.type.name === "paragraph" &&
            selection.node.content.size === 0;

          if (selection.empty || isEmptyParagraphNodeSelection) {
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
  const { editor, node, updateAttributes, selected } = props;
  const t = useT();
  const attrs = node.attrs as { variant: CalloutVariant; emoji: string | null };
  const variant = attrs.variant ?? "info";
  const style = CALLOUT_VARIANTS[variant] ?? CALLOUT_VARIANTS.info;
  const emoji = attrs.emoji ?? style.emoji;
  const wrapRef = useRef<HTMLDivElement>(null);

  const clearInnerSelectedNodes = useCallback(() => {
    if (!wrapRef.current) return;
    wrapRef.current
      .querySelectorAll(".ProseMirror-selectednode")
      .forEach((el) => {
        el.classList.remove("ProseMirror-selectednode");
        el.removeAttribute("draggable");
      });
  }, []);

  useEffect(() => {
    const run = () => {
      clearInnerSelectedNodes();
      requestAnimationFrame(clearInnerSelectedNodes);
    };
    requestAnimationFrame(run);
  }, [clearInnerSelectedNodes]);

  useEffect(() => {
    if (!selected) return;
    const run = () => {
      clearInnerSelectedNodes();
      requestAnimationFrame(clearInnerSelectedNodes);
    };
    requestAnimationFrame(run);
  }, [selected, clearInnerSelectedNodes]);

  const [variantOpen, setVariantOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const variantBtnRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const variantPanelRef = useRef<HTMLDivElement>(null);

  const PANEL_GAP = 4;
  const VIEWPORT_MARGIN = 8;

  const calcPanelPosition = useCallback((btn: HTMLElement, panel: HTMLElement, placement: "bottom-start" | "top-end") => {
    const br = btn.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (placement === "bottom-start") {
      top = br.bottom + PANEL_GAP;
      left = br.left;
      if (top + pr.height > vh - VIEWPORT_MARGIN) {
        top = br.top - PANEL_GAP - pr.height;
      }
    } else {
      top = br.top - PANEL_GAP - pr.height;
      left = br.right - pr.width;
      if (top < VIEWPORT_MARGIN) {
        top = br.bottom + PANEL_GAP;
      }
    }

    if (left + pr.width > vw - VIEWPORT_MARGIN) left = vw - pr.width - VIEWPORT_MARGIN;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    return { top, left };
  }, [PANEL_GAP, VIEWPORT_MARGIN]);

  const reflowPanels = useCallback((open: { emoji: boolean; variant: boolean }) => {
    setPanelStyle((prev) => {
      let nextTop = prev.top;
      let nextLeft = prev.left;
      if (open.emoji && emojiBtnRef.current && emojiPanelRef.current) {
        const pos = calcPanelPosition(emojiBtnRef.current, emojiPanelRef.current, "bottom-start");
        nextTop = pos.top;
        nextLeft = pos.left;
      } else if (open.variant && variantBtnRef.current && variantPanelRef.current) {
        const pos = calcPanelPosition(variantBtnRef.current, variantPanelRef.current, "top-end");
        nextTop = pos.top;
        nextLeft = pos.left;
      }
      return nextTop === prev.top && nextLeft === prev.left ? prev : { top: nextTop, left: nextLeft };
    });
  }, [calcPanelPosition]);

  useLayoutEffect(() => {
    if (emojiOpen) reflowPanels({ emoji: true, variant: false });
  }, [emojiOpen, emojiQuery, reflowPanels]);

  useLayoutEffect(() => {
    if (variantOpen) reflowPanels({ emoji: false, variant: true });
  }, [variantOpen, reflowPanels]);

  useEffect(() => {
    if (!variantOpen && !emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !wrapRef.current?.contains(target) &&
        !emojiPanelRef.current?.contains(target) &&
        !variantPanelRef.current?.contains(target)
      ) {
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
    const onReposition = () => {
      reflowPanels({ emoji: emojiOpen, variant: variantOpen });
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [variantOpen, emojiOpen, reflowPanels]);

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
    <NodeViewWrapper
      ref={wrapRef}
      className={`tk-callout tk-callout-${variant}`}
      style={{ color: style.textColor, borderColor: style.borderColor, background: style.backgroundColor }}
    >
      <div className="tk-callout-head">
        <button
          ref={emojiBtnRef}
          type="button"
          className="tk-callout-emoji"
          title={t("callout.changeIcon")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setEmojiOpen((v) => !v);
            setVariantOpen(false);
          }}
        >
          {emoji}
        </button>
      </div>
      {emojiOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={emojiPanelRef}
            className="tk-callout-emoji-panel tk-portal-panel"
            contentEditable={false}
            style={{ position: "fixed", top: panelStyle.top, left: panelStyle.left }}
          >
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
          </div>,
          document.body
        )}
      <NodeViewContent className="tk-callout-content" />
      {editor.isEditable && (
        <div className="tk-callout-switcher">
          <button
            ref={variantBtnRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setVariantOpen((v) => !v);
              setEmojiOpen(false);
            }}
            className="tk-callout-switcher-btn"
            title={t("callout.switchStyle")}
          >
            {t(`callout.${variant}`)}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {variantOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={variantPanelRef}
                className="tk-callout-variant-panel tk-portal-panel"
                style={{ position: "fixed", top: panelStyle.top, left: panelStyle.left }}
              >
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
                      <span>{t(`callout.${v}`)}</span>
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default Callout;
