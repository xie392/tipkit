"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useT, useEditorEditable } from "@tipkit/core";

/* Iframe 嵌入（迁移自 blog rich-text/ext/iframe.tsx）。
 * 属性：url / width / height；空 url 显示输入卡片，有 url 渲染 iframe，可拖拽改高度。 */

export interface IframeAttrs {
  url: string | null;
  width: string;
  height: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    iframe: {
      setIframe: (attrs?: Partial<IframeAttrs>) => ReturnType;
    };
  }
}

export const Iframe = Node.create({
  name: "iframe",
  content: "",
  marks: "",
  group: "block",
  selectable: true,
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-iframe" } };
  },

  addAttributes() {
    return {
      url: {
        default: null as string | null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-url") ??
          (el as HTMLIFrameElement).getAttribute("src") ??
          null,
        renderHTML: (a) => (a.url ? { "data-url": a.url } : {}),
      },
      width: {
        default: "100%",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-width") ?? "100%",
        renderHTML: (a) => ({ "data-width": a.width }),
      },
      height: {
        default: 360,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute("data-height")) || 360,
        renderHTML: (a) => ({ "data-height": a.height }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-iframe" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const url = (attrs["data-url"] as string) || "";
    const width = (attrs["data-width"] as string) || "100%";
    const height = Number(attrs["data-height"]) || 360;
    const base = mergeAttributes(this.options.HTMLAttributes, {
      "data-url": url,
      "data-width": width,
      "data-height": height,
    });
    if (!url) return ["div", base];
    return [
      "div",
      base,
      [
        "div",
        { class: "tk-iframe-inner", style: `width:${width};height:${height}px` },
        [
          "iframe",
          {
            src: url,
            class: "tk-iframe-frame",
            title: "iframe 嵌入",
            loading: "lazy",
            sandbox:
              "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation",
            allow:
              "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
          },
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setIframe:
        (attrs) =>
        ({ chain, state }) => {
          const sel = state.selection as unknown as { node?: { type: { name: string } } };
          if (sel.node?.type?.name === this.name) {
            return chain().focus().updateAttributes(this.name, attrs ?? {}).run();
          }
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: {
                url: attrs?.url ?? null,
                width: attrs?.width ?? "100%",
                height: attrs?.height ?? 360,
              },
            })
            .run();
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$iframe\$$/,
        type: this.type,
        getAttributes: () => ({ url: null }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(IframeView);
  },
});

function disableScrollAnchoring(): () => void {
  const STYLE_ID = "tk-iframe-no-anchor";
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "* { overflow-anchor: none !important; }";
    document.head.appendChild(style);
  }
  return () => {
    style?.remove();
  };
}

function IframeView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected } = props;
  const t = useT();
  const attrs = node.attrs as IframeAttrs;
  const { url, width, height } = attrs;
  const isEditable = useEditorEditable(editor);

  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [editing, setEditing] = useState(!url);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragHRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftUrl(url ?? "");
    if (url) setEditing(false);
  }, [url]);

  useEffect(() => {
    if (!isEditable) setEditing(false);
  }, [isEditable]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const commitUrl = () => {
    const u = draftUrl.trim();
    if (!u) return;
    updateAttributes({ url: u });
    setEditing(false);
  };

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isEditable) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);

      const startY = e.clientY;
      const startH = height;

      const restoreAnchoring = disableScrollAnchoring();

      const onMove = (ev: PointerEvent) => {
        const next = Math.max(120, Math.min(1200, startH + (ev.clientY - startY)));
        dragHRef.current = next;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (dragHRef.current !== null && wrapRef.current) {
              wrapRef.current.style.height = `${dragHRef.current}px`;
            }
          });
        }
      };

      const finish = (commit: boolean) => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        const finalH = dragHRef.current;
        dragHRef.current = null;
        restoreAnchoring();
        if (commit && finalH !== null) updateAttributes({ height: finalH });
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
    },
    [height, isEditable, updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={`tk-iframe${selected ? " is-selected" : ""}`}
      data-has-url={url ? "true" : "false"}
    >
      {url && !editing ? (
        <div ref={wrapRef} className="tk-iframe-inner" style={{ width, height }}>
          <iframe
            src={url}
            className="tk-iframe-frame"
            title="iframe 嵌入"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : (
        <div className="tk-iframe-empty">
          <div className="tk-iframe-empty-title">嵌入网页 / 视频</div>
          <input
            autoFocus
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitUrl();
              if (e.key === "Escape") setEditing(!!url);
            }}
            placeholder="粘贴 B 站 / YouTube / 网页链接"
            className="tk-iframe-input"
          />
          <div className="tk-iframe-empty-actions">
            {url && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(false)}
                className="tk-iframe-btn"
              >
                取消
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitUrl}
              className="tk-iframe-btn tk-iframe-btn-primary"
            >
              嵌入
            </button>
          </div>
        </div>
      )}
      {url && !editing && isEditable && (
        <>
          <span
            role="button"
            aria-label={t("iframeView.dragResize")}
            title={t("iframeView.dragResize")}
            onPointerDown={onResizeDown}
            style={{ touchAction: "none" }}
            className="tk-iframe-handle"
          />
          <button
            type="button"
            title={t("iframeView.changeLink")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(true)}
            className="tk-iframe-edit"
          >
            {t("iframeView.changeLink")}
          </button>
        </>
      )}
    </NodeViewWrapper>
  );
}

export default Iframe;
