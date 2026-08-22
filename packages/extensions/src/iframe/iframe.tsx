"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

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
            .insertContent({ type: this.name, attrs: { url: attrs?.url ?? null } })
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

function IframeView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected } = props;
  const attrs = node.attrs as IframeAttrs;
  const { url, width, height } = attrs;
  const isEditable = editor.isEditable;

  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [editing, setEditing] = useState(!url);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);

  useEffect(() => {
    setDraftUrl(url ?? "");
    if (url) setEditing(false);
  }, [url]);

  const commitUrl = () => {
    const u = draftUrl.trim();
    if (!u) return;
    updateAttributes({ url: u });
    setEditing(false);
  };

  const onResizeDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startH = height;

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(120, Math.min(1200, startH + (ev.clientY - startY)));
        setDragH(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setDragH((finalH) => {
          if (finalH !== null) updateAttributes({ height: finalH });
          return null;
        });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height, isEditable, updateAttributes],
  );

  const effectiveH = dragH ?? height;

  return (
    <NodeViewWrapper
      className={`tk-iframe${selected ? " is-selected" : ""}`}
      data-has-url={url ? "true" : "false"}
    >
      {url && !editing ? (
        <div ref={wrapRef} className="tk-iframe-inner" style={{ width, height: effectiveH }}>
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
            aria-label="拖拽调整高度"
            title="拖拽调整高度"
            onMouseDown={onResizeDown}
            className="tk-iframe-handle"
          />
          <button
            type="button"
            title="编辑链接"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(true)}
            className="tk-iframe-edit"
          >
            改链接
          </button>
        </>
      )}
    </NodeViewWrapper>
  );
}

export default Iframe;
