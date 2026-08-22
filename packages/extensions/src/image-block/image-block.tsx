import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ImageBlock 节点（迁移自 blog rich-text/ext/image-block/image-block.ts）。
 * - parseHTML 只认 div[data-type="image-block"]，与 inline <img> 共存
 * - width 用百分比字符串（"25"/"50"/"100" 等）
 * - align：left / center / right；caption：就地编辑说明文字
 * 视觉剥离：NodeView 只输出布局与 tk-* 语义类名，视觉归主题 CSS。 */

export interface ImageBlockAttrs {
  src: string;
  width: string;
  align: "left" | "center" | "right";
  alt?: string;
  caption?: string | null;
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
        parseHTML: (el) => (el as HTMLElement).getAttribute("alt") ?? undefined,
        renderHTML: (a) => (a.alt ? { alt: a.alt } : {}),
      },
      caption: {
        default: null,
        parseHTML: (el) => {
          const cap = (el as HTMLElement).querySelector(".tk-ib-caption");
          return cap ? (cap.textContent ?? null) : null;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='image-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const align = (attrs["data-align"] as string) ?? "center";
    const width = (attrs["data-width"] as string) ?? "100%";
    return [
      "div",
      {
        "data-type": "image-block",
        "data-align": align,
        "data-width": width,
      },
      ["img", { src: attrs.src, alt: attrs.alt ?? "" }],
    ];
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
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

/** ImageBlock NodeView：图片 + 宽度拖拽 + 就地 caption。视觉走主题。 */
function ImageBlockView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected } = props;
  const attrs = node.attrs as unknown as ImageBlockAttrs;
  const { src, width, align, alt, caption } = attrs;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);

  useEffect(() => {
    if (editingCaption && captionRef.current) {
      captionRef.current.textContent = caption ?? "";
      captionRef.current.focus();
    }
  }, [editingCaption, caption]);

  const commitCaption = () => {
    setEditingCaption(false);
    const text = captionRef.current?.textContent ?? "";
    updateAttributes({ caption: text.trim() ? text : null });
  };

  const onHandleDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editor.isEditable) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = wrapRef.current?.getBoundingClientRect().width ?? 0;
      const containerW =
        wrapRef.current?.parentElement?.getBoundingClientRect().width ?? startW;
      const startPercent = (startW / containerW) * 100 || Number(width) || 100;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const next = Math.max(15, Math.min(100, startPercent + (dx / containerW) * 100));
        setDragWidth(Math.round(next));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setDragWidth((finalW) => {
          if (finalW !== null) updateAttributes({ width: `${finalW}%` });
          return null;
        });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [editor.isEditable, width, updateAttributes],
  );

  const effectiveWidth = dragWidth ?? (Number(String(width).replace("%", "")) || 100);
  const wrapperAlign =
    align === "left" ? "ml-0 mr-auto" : align === "right" ? "ml-auto mr-0" : "mx-auto";

  return (
    <NodeViewWrapper className="tk-image-block" data-align={align} data-selected={selected ? "true" : undefined}>
      <div
        ref={wrapRef}
        className={`tk-image-block-wrap ${wrapperAlign}`}
        style={{ width: `${effectiveWidth}%`, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} className="tk-image-block-img block w-full h-auto" draggable={false} />
        {selected && editor.isEditable && (
          <span
            role="button"
            aria-label="拖拽调整宽度"
            title="拖拽调整宽度"
            onMouseDown={onHandleDown}
            className="tk-image-block-handle"
          />
        )}
        {dragWidth !== null && <span className="tk-image-block-width-tag">{Math.round(effectiveWidth)}%</span>}
      </div>

      {(editingCaption || caption) && (
        <div
          ref={captionRef}
          contentEditable={editor.isEditable && editingCaption}
          suppressContentEditableWarning
          data-placeholder="图片说明…"
          className={`tk-image-block-caption ${wrapperAlign}`}
          style={{ width: `${effectiveWidth}%`, maxWidth: "100%" }}
          onBlur={commitCaption}
          onClick={(e) => {
            if (editor.isEditable && !editingCaption) {
              e.stopPropagation();
              setEditingCaption(true);
            }
          }}
        />
      )}
      {selected && editor.isEditable && !caption && !editingCaption && (
        <button
          type="button"
          className={`tk-image-block-add-caption ${wrapperAlign}`}
          style={{ width: `${effectiveWidth}%`, maxWidth: "100%" }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setEditingCaption(true);
          }}
        >
          + 添加说明
        </button>
      )}
    </NodeViewWrapper>
  );
}

export default ImageBlock;
