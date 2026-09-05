"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useDismiss, useT, useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";
import { emojisToName } from "../shared/emoji/emoji-data";
import { CALLOUT_VARIANTS, CALLOUT_VARIANT_EMOJIS, type CalloutVariant } from "./callout";

/* Callout 节点视图：hover 工具栏 + emoji 选择器 + 变体切换面板。
 * 变体配色由 themes 层的 .tk-callout-{variant} / .is-{variant} 类承担。 */

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

const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 8;

type PanelPlacement = "bottom-start" | "top-end";

function calcPanelPosition(btn: HTMLElement, panel: HTMLElement, placement: PanelPlacement) {
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
}

export function CalloutView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected, getPos, deleteNode } = props;
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const attrs = node.attrs as { variant: CalloutVariant; emoji: string | null };
  const variant = attrs.variant ?? "info";
  const emoji = attrs.emoji ?? CALLOUT_VARIANT_EMOJIS[variant] ?? CALLOUT_VARIANT_EMOJIS.info;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(wrapRef);
  const { visible, show, hide } = useToolbarVisibility();
  const [hovered, setHovered] = useState(false);

  const handleDuplicate = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
  };

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
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const variantBtnRef = useRef<HTMLButtonElement>(null);
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const variantPanelRef = useRef<HTMLDivElement>(null);

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
  }, []);

  useLayoutEffect(() => {
    if (emojiOpen) reflowPanels({ emoji: true, variant: false });
  }, [emojiOpen, emojiQuery, reflowPanels]);

  useLayoutEffect(() => {
    if (variantOpen) reflowPanels({ emoji: false, variant: true });
  }, [variantOpen, reflowPanels]);

  const closePanels = useCallback(() => {
    setVariantOpen(false);
    setEmojiOpen(false);
  }, []);
  const repositionPanels = useCallback(() => {
    reflowPanels({ emoji: emojiOpen, variant: variantOpen });
  }, [reflowPanels, emojiOpen, variantOpen]);
  useDismiss(variantOpen || emojiOpen, [wrapRef, emojiPanelRef, variantPanelRef], closePanels, repositionPanels);

  const filteredEmojis = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    return q ? emojisToName.filter((e) => e.name.includes(q)).slice(0, 60) : emojisToName.slice(0, 60);
  }, [emojiQuery]);

  useEffect(() => {
    if (!isEditable) {
      setVariantOpen(false);
      setEmojiOpen(false);
    }
  }, [isEditable]);

  const pickEmoji = (e: string) => {
    updateAttributes({ emoji: e });
    setEmojiOpen(false);
    setEmojiQuery("");
  };

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`tk-callout tk-callout-${variant} tk-hover-toolbar${isEditable ? " is-editable" : ""}${hovered ? " is-hovered" : ""}`}
      onMouseEnter={() => {
        if (isEditable) setHovered(true);
        show();
      }}
      onMouseLeave={() => {
        setHovered(false);
        hide();
      }}
    >
      {isEditable && (
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
              data-tip={t("block.duplicate")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconCopy />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              className="tk-ct-btn is-danger"
              data-tip={t("block.delete")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteNode()}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
      <div className="tk-callout-head">
        {isEditable ? (
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
        ) : (
          <span className="tk-callout-emoji" aria-hidden="true">
            {emoji}
          </span>
        )}
      </div>
      {isEditable && emojiOpen &&
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
      {isEditable && (
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
                {CALLOUT_VARIANTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      updateAttributes({ variant: v });
                      setVariantOpen(false);
                    }}
                    className={`tk-callout-variant-cell is-${v}${v === variant ? " is-active" : ""}`}
                  >
                    <span>{CALLOUT_VARIANT_EMOJIS[v]}</span>
                    <span>{t(`callout.${v}`)}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
