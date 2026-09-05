"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { beginPointerDrag, useDismiss, useEditorEditable, useT, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";
import { ImagePreview } from "./image-preview";
import type { ImageBlockAttrs, ImageStyleType } from "./image-block";

/* ImageBlock NodeView：图片 + 左右宽度拖拽手柄 + 就地 caption + 预览。视觉走主题。 */
export function ImageBlockView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected, getPos, deleteNode } = props;
  const isEditable = useEditorEditable(editor);
  const t = useT();
  const attrs = node.attrs as unknown as ImageBlockAttrs;
  const { src, width, align, alt, caption, imageStyle = "none" } = attrs;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(rootRef);
  const { visible, show, hide } = useToolbarVisibility();
  const captionRef = useRef<HTMLDivElement | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragWidthRef = useRef<number | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [preview, setPreview] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const styleWrapRef = useRef<HTMLDivElement | null>(null);

  const STYLE_OPTIONS: { value: ImageStyleType; label: string }[] = [
    { value: "none", label: t("image.styleNone") },
    { value: "border", label: t("image.styleBorder") },
    { value: "shadow", label: t("image.styleShadow") },
    { value: "border-shadow", label: t("image.styleBorderShadow") },
  ];
  const currentStyle = (attrs.imageStyle as ImageStyleType) || "none";

  // 样式下拉：点击外部或 Esc 关闭
  useDismiss(styleOpen, [styleWrapRef], () => setStyleOpen(false));

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
      const startX = e.clientX;
      const wrapEl = wrapRef.current;
      const startW = wrapEl?.getBoundingClientRect().width ?? 0;
      const containerW = wrapEl?.parentElement?.getBoundingClientRect().width ?? startW;
      const startPercent = (startW / containerW) * 100 || Number(width) || 100;

      beginPointerDrag(e, {
        onMove: (ev) => {
          const dx = ev.clientX - startX;
          const delta = (dx / containerW) * 100;
          const next = side === "right" ? startPercent + delta : startPercent - delta;
          dragWidthRef.current = Math.max(15, Math.min(100, Math.round(next)));
        },
        // rAF 合帧：宽度标签与布局每帧至多更新一次
        onFrame: () => setDragWidth(dragWidthRef.current),
        onFinish: (commit) => {
          const finalW = dragWidthRef.current;
          dragWidthRef.current = null;
          setDragWidth(null);
          if (commit && finalW !== null) updateAttributes({ width: `${finalW}%` });
        },
      });
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
      className={`tk-image-block tk-hover-toolbar${isEditable ? " is-editable" : " is-readonly"}${hovered ? " is-hovered" : ""}${attrs.uploading ? " is-uploading" : ""}`}
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
              data-tip={t("image.replace")}
              aria-label={t("image.replace")}
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
                data-tip={t("image.style")}
                aria-label={t("image.style")}
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
              data-tip={t("image.alignLeft")}
              aria-label={t("image.alignLeft")}
              className={`tk-ct-btn${align === "left" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "left" })}
            >
              <IconAlignLeft />
            </button>
            <button
              type="button"
              data-tip={t("image.alignCenter")}
              aria-label={t("image.alignCenter")}
              className={`tk-ct-btn${align === "center" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "center" })}
            >
              <IconAlignCenter />
            </button>
            <button
              type="button"
              data-tip={t("image.alignRight")}
              aria-label={t("image.alignRight")}
              className={`tk-ct-btn${align === "right" ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ align: "right" })}
            >
              <IconAlignRight />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              data-tip={t("block.duplicate")}
              aria-label={t("block.duplicate")}
              className="tk-ct-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconDuplicate />
            </button>
            <button
              type="button"
              data-tip={t("block.delete")}
              aria-label={t("block.delete")}
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
        {attrs.uploading && (
          <div className="tk-image-block-uploading" contentEditable={false}>
            <span className="tk-image-block-uploading-spinner" aria-hidden="true" />
            <span className="tk-image-block-uploading-text">{t("image.uploading")}</span>
          </div>
        )}
        {showHandles && (
          <>
            <span
              role="slider"
              aria-label={t("image.resize")}
              title={t("image.resize")}
              tabIndex={-1}
              onPointerDown={startResize("left")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-tl"
            />
            <span
              role="slider"
              aria-label={t("image.resize")}
              title={t("image.resize")}
              tabIndex={-1}
              onPointerDown={startResize("right")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-tr"
            />
            <span
              role="slider"
              aria-label={t("image.resize")}
              title={t("image.resize")}
              tabIndex={-1}
              onPointerDown={startResize("left")}
              style={{ touchAction: "none", ...(toolsVisible ? visibleStyle : hiddenStyle) }}
              className="tk-image-block-handle is-bl"
            />
            <span
              role="slider"
              aria-label={t("image.resize")}
              title={t("image.resize")}
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
          data-placeholder={t("image.captionPlaceholder")}
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

