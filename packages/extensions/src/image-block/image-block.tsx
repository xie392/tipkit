import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";
import { ImagePreview } from "./image-preview";

/* ImageBlock 节点（迁移自 blog rich-text/ext/image-block/image-block.ts）。
 * - parseHTML 只认 div[data-type="image-block"]，与 inline <img> 共存
 * - width 用百分比字符串（"25"/"50"/"100" 等）
 * - align：left / center / right；caption：就地编辑说明文字
 * 视觉剥离：NodeView 只输出布局与 tk-* 语义类名，视觉归主题 CSS。 */

export type ImageStyleType = "none" | "border" | "shadow" | "border-shadow";

export interface ImageBlockAttrs {
  src: string;
  width: string;
  align: "left" | "center" | "right";
  alt?: string;
  caption?: string | null;
  imageStyle?: ImageStyleType;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: { src: string; alt?: string }) => ReturnType;
      setImageBlockAt: (
        attributes: { src: string; pos: number | import("@tiptap/core").Range },
      ) => ReturnType;
      setImageBlockAlign: (align: "left" | "center" | "right") => ReturnType;
      setImageBlockWidth: (width: number) => ReturnType;
      setImageBlockCaption: (caption: string | null) => ReturnType;
      setImageBlockStyle: (style: ImageStyleType) => ReturnType;
    };
  }
}

export const ImageBlock = Image.extend({
  name: "imageBlock",

  group: "block",

  defining: true,

  isolating: true,

  selectable: true,

  allowGapCursor: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => {
          const root = el as HTMLElement;
          const img = root.querySelector("img");
          return (img?.getAttribute("src") ?? root.getAttribute("src") ?? "") as string;
        },
        renderHTML: (a) => ({ src: a.src }),
      },
      width: {
        default: "100%",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-width") ?? "100%",
        renderHTML: (a) => ({ "data-width": a.width }),
      },
      align: {
        default: "center",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-align") ?? "center",
        renderHTML: (a) => ({ "data-align": a.align }),
      },
      alt: {
        default: undefined,
        parseHTML: (el) => {
          const root = el as HTMLElement;
          const img = root.querySelector("img");
          return (img?.getAttribute("alt") ?? root.getAttribute("alt") ?? undefined) as
            | string
            | undefined;
        },
        renderHTML: (a) => (a.alt ? { alt: a.alt } : {}),
      },
      caption: {
        default: null,
        parseHTML: (el) => {
          const cap = (el as HTMLElement).querySelector(".tk-image-block-caption");
          return cap ? (cap.textContent ?? null) : null;
        },
        renderHTML: () => ({}),
      },
      imageStyle: {
        default: "none",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-image-style") ?? "none",
        renderHTML: (a) => ({ "data-image-style": a.imageStyle }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='image-block']" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const align = (attrs["data-align"] as string) ?? "center";
    const width = (attrs["data-width"] as string) ?? "100%";
    const imageStyle = (attrs["data-image-style"] as string) ?? "none";
    const caption = (node.attrs.caption as string | null) ?? null;
    const result: [string, Record<string, unknown>, ...any[]] = [
      "div",
      {
        "data-type": "image-block",
        "data-align": align,
        "data-width": width,
        "data-image-style": imageStyle,
      },
      [
        "img",
        {
          src: attrs.src,
          alt: attrs.alt ?? "",
          class: `tk-image-style-${imageStyle}`,
          style: `width:${width};max-width:100%`,
        },
      ],
    ];
    if (caption) {
      result.push(["div", { class: "tk-image-block-caption" }, caption]);
    }
    return result;
  },

  addCommands() {
    return {
      setImageBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: "imageBlock",
            attrs: { src: attrs.src, alt: attrs.alt },
          }),
      setImageBlockAt:
        (attrs) =>
        ({ commands }) =>
          commands.insertContentAt(attrs.pos, {
            type: "imageBlock",
            attrs: { src: attrs.src },
          }),
      setImageBlockAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("imageBlock", { align }),
      setImageBlockWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("imageBlock", {
            width: `${Math.max(0, Math.min(100, width))}%`,
          }),
      setImageBlockCaption:
        (caption) =>
        ({ commands }) =>
          commands.updateAttributes("imageBlock", { caption }),
      setImageBlockStyle:
        (style) =>
        ({ commands }) =>
          commands.updateAttributes("imageBlock", { imageStyle: style }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

/** ImageBlock NodeView：图片 + 左右宽度拖拽手柄 + 就地 caption + 预览。视觉走主题。 */
function ImageBlockView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected, getPos, deleteNode } = props;
  const isEditable = useEditorEditable(editor);
  const attrs = node.attrs as unknown as ImageBlockAttrs;
  const { src, width, align, alt, caption, imageStyle = "none" } = attrs;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(rootRef);
  const { visible, show, hide } = useToolbarVisibility();
  const captionRef = useRef<HTMLDivElement | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragWidthRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [preview, setPreview] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const styleWrapRef = useRef<HTMLDivElement | null>(null);

  const STYLE_OPTIONS: { value: ImageStyleType; label: string }[] = [
    { value: "none", label: "无样式" },
    { value: "border", label: "边框" },
    { value: "shadow", label: "阴影" },
    { value: "border-shadow", label: "边框 + 阴影" },
  ];
  const currentStyle = (attrs.imageStyle as ImageStyleType) || "none";

  // 样式下拉：点击外部或 Esc 关闭
  useEffect(() => {
    if (!styleOpen) return;
    const onDown = (e: MouseEvent) => {
      if (styleWrapRef.current && !styleWrapRef.current.contains(e.target as Node)) {
        setStyleOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStyleOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [styleOpen]);

  useEffect(() => {
    if (!isEditable) setEditingCaption(false);
  }, [isEditable]);

  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    if (editingCaption) {
      el.textContent = caption ?? "";
      el.focus();
    } else {
      el.textContent = caption ?? "";
    }
  }, [editingCaption, caption]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const commitCaption = () => {
    setEditingCaption(false);
    const text = captionRef.current?.textContent ?? "";
    updateAttributes({ caption: text.trim() ? text : null });
  };

  const replaceImage = useCallback(() => {
    if (!isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        updateAttributes({ src: dataUrl });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [isEditable, updateAttributes]);

  const handleDuplicate = useCallback(() => {
    if (!isEditable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
  }, [editor, node, getPos, isEditable]);

  const startResize = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent) => {
      if (!isEditable) return;
      e.preventDefault();
      e.stopPropagation();
      // 指针捕获：窗口外松开时 pointerup 也能收到，避免监听器悬挂导致拖拽不结束
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const wrapEl = wrapRef.current;
      const startW = wrapEl?.getBoundingClientRect().width ?? 0;
      const containerW = wrapEl?.parentElement?.getBoundingClientRect().width ?? startW;
      const startPercent = (startW / containerW) * 100 || Number(width) || 100;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const delta = (dx / containerW) * 100;
        const next = side === "right" ? startPercent + delta : startPercent - delta;
        dragWidthRef.current = Math.max(15, Math.min(100, Math.round(next)));
        // rAF 合帧：宽度标签与布局每帧至多更新一次
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            setDragWidth(dragWidthRef.current);
          });
        }
      };

      const finish = (commit: boolean) => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        const finalW = dragWidthRef.current;
        dragWidthRef.current = null;
        setDragWidth(null);
        if (commit && finalW !== null) updateAttributes({ width: `${finalW}%` });
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
    },
    [isEditable, width, updateAttributes],
  );

  const effectiveWidth = dragWidth ?? (Number(String(width).replace("%", "")) || 100);
  const wrapperAlign =
    align === "left" ? "tk-align-left" : align === "right" ? "tk-align-right" : "tk-align-center";
  const showHandles = isEditable;
  const toolsVisible = showHandles && (hovered || selected);

  const onImageClick = (e: React.MouseEvent) => {
    if (isEditable) return;
    e.preventDefault();
    setPreview(true);
  };

  const hiddenStyle: CSSProperties = {
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
  };
  const visibleStyle: CSSProperties = {
    opacity: 1,
    visibility: "visible",
    pointerEvents: "auto",
  };

  return (
    <NodeViewWrapper
      ref={rootRef}
      className={`tk-image-block tk-hover-toolbar${isEditable ? " is-editable" : " is-readonly"}${hovered ? " is-hovered" : ""}`}
      data-align={align}
      data-selected={selected ? "true" : undefined}
      onMouseEnter={() => {
        setHovered(true);
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
              data-tip="替换图片"
              aria-label="替换图片"
              className="tk-ct-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={replaceImage}
            >
              <IconUpload />
            </button>
            <span className="tk-ct-sep" />
            <div className="tk-block-action-dropdown" ref={styleWrapRef}>
              <button
                type="button"
                data-tip="设置样式"
                aria-label="设置样式"
                className={`tk-ct-btn${styleOpen ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setStyleOpen((v) => !v)}
              >
                <IconStyle />
              </button>
              {styleOpen && (
                <div
                  className="tk-block-action-menu"
                  contentEditable={false}
                  style={{ minWidth: 132 }}
                >
                  {STYLE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`tk-block-action-item${currentStyle === o.value ? " is-active" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateAttributes({ imageStyle: o.value });
                        setStyleOpen(false);
                      }}
                    >
                      <span className="tk-image-style-option">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              data-tip="左对齐"
              aria-label="左对齐"
              className={`tk-ct-btn${align === "left" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "left" })}
            >
              <IconAlignLeft />
            </button>
            <button
              type="button"
              data-tip="居中"
              aria-label="居中"
              className={`tk-ct-btn${align === "center" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "center" })}
            >
              <IconAlignCenter />
            </button>
            <button
              type="button"
              data-tip="右对齐"
              aria-label="右对齐"
              className={`tk-ct-btn${align === "right" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "right" })}
            >
              <IconAlignRight />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              data-tip="复制"
              aria-label="复制"
              className="tk-ct-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconDuplicate />
            </button>
            <button
              type="button"
              data-tip="删除"
              aria-label="删除"
              className="tk-ct-btn is-danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteNode()}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
      <div
        ref={wrapRef}
        className={`tk-image-block-wrap ${wrapperAlign}${selected ? " is-selected" : ""}`}
        style={{ width: `${effectiveWidth}%`, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          className={`tk-image-block-img tk-image-style-${imageStyle} tk-block tk-w-full tk-h-auto`}
          draggable={false}
          onClick={onImageClick}
        />
        {showHandles && (
          <>
            <span
              role="slider"
              aria-label="左上角拖拽调整大小"
              title="拖拽调整大小"
              tabIndex={-1}
              onPointerDown={startResize("left")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-tl"
            />
            <span
              role="slider"
              aria-label="右上角拖拽调整大小"
              title="拖拽调整大小"
              tabIndex={-1}
              onPointerDown={startResize("right")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-tr"
            />
            <span
              role="slider"
              aria-label="左下角拖拽调整大小"
              title="拖拽调整大小"
              tabIndex={-1}
              onPointerDown={startResize("left")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-bl"
            />
            <span
              role="slider"
              aria-label="右下角拖拽调整大小"
              title="拖拽调整大小"
              tabIndex={-1}
              onPointerDown={startResize("right")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-br"
            />
          </>
        )}
        {dragWidth !== null && (
          <span className="tk-image-block-width-tag">{Math.round(effectiveWidth)}%</span>
        )}
      </div>

      {(editingCaption || caption) && (
        <div
          ref={captionRef}
          contentEditable={isEditable && editingCaption}
          suppressContentEditableWarning
          data-placeholder="图片说明…"
          className={`tk-image-block-caption ${wrapperAlign}`}
          style={{ width: `${effectiveWidth}%`, maxWidth: "100%" }}
          onBlur={commitCaption}
          onClick={(e) => {
            if (isEditable && !editingCaption) {
              e.stopPropagation();
              setEditingCaption(true);
            }
          }}
        />
      )}
      {showHandles && !caption && !editingCaption && (
        <button
          type="button"
          className={`tk-image-block-add-caption ${wrapperAlign}`}
          style={{
            width: `${effectiveWidth}%`,
            maxWidth: "100%",
            ...(toolsVisible ? visibleStyle : hiddenStyle),
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setEditingCaption(true);
          }}
        >
          + 添加说明
        </button>
      )}

      {preview && <ImagePreview src={src} alt={alt} onClose={() => setPreview(false)} />}
    </NodeViewWrapper>
  );
}

/* ---- 内联图标组件 ---- */

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M5 5l3-3 3 3" />
      <path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function IconStyle() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6.5" r="1" />
      <path d="M4.5 12.5 8 9l4 3.5" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="2" y1="7" x2="9" y2="7" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <line x1="2" y1="15" x2="9" y2="15" />
    </svg>
  );
}

function IconAlignCenter() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="3.5" y1="7" x2="12.5" y2="7" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <line x1="3.5" y1="15" x2="12.5" y2="15" />
    </svg>
  );
}

function IconAlignRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="7" y1="7" x2="14" y2="7" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <line x1="7" y1="15" x2="14" y2="15" />
    </svg>
  );
}

function IconDuplicate() {
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

export default ImageBlock;
