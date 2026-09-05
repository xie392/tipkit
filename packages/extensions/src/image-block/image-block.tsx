import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import type { CommandProps } from "@tiptap/core";
import { ImageBlockView } from "./image-block-view";

/* ImageBlock 节点（迁移自 blog rich-text/ext/image-block/image-block.ts）。
 * - parseHTML 只认 div[data-type="image-block"]，与 inline <img> 共存
 * - width 用百分比字符串（"25"/"50"/"100" 等）
 * - align：left / center / right；caption：就地编辑说明文字
 * - imageStyle：none / border / shadow / border-shadow，新插入图片沿袭文内
 *   最近的 imageBlock 的样式/对齐/宽度（见 lastImageBlockAttrs）
 * 视觉剥离：NodeView 只输出布局与 tk-* 语义类名，视觉归主题 CSS。 */

export type ImageStyleType = "none" | "border" | "shadow" | "border-shadow";

export interface ImageBlockAttrs {
  src: string;
  width: string;
  align: "left" | "center" | "right";
  alt?: string;
  caption?: string | null;
  imageStyle?: ImageStyleType;
  /** 上传中占位态（不序列化到 HTML） */
  uploading?: boolean;
  uploadId?: string | null;
}

/** 取文档中最后一个 imageBlock 的外观属性，用于新插入图片沿袭同类设置 */
function lastImageBlockAttrs({ state }: CommandProps) {
  let result: Partial<Pick<ImageBlockAttrs, "width" | "align" | "imageStyle">> = {};
  state.doc.descendants((node) => {
    if (node.type.name === "imageBlock") {
      result = {
        width: node.attrs.width as string,
        align: node.attrs.align as ImageBlockAttrs["align"],
        imageStyle: node.attrs.imageStyle as ImageStyleType,
      };
    }
  });
  return result;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: {
        src: string;
        alt?: string;
        uploading?: boolean;
        uploadId?: string | null;
      }) => ReturnType;
      setImageBlockAt: (
        attributes: {
          src: string;
          pos: number | import("@tiptap/core").Range;
          uploading?: boolean;
          uploadId?: string | null;
        },
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
      uploading: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
      uploadId: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
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
        (props) =>
          props.commands.insertContent({
            type: "imageBlock",
            attrs: { ...lastImageBlockAttrs(props), ...attrs },
          }),
      setImageBlockAt:
        (attrs) =>
        (props) =>
          props.commands.insertContentAt(attrs.pos, {
            type: "imageBlock",
            attrs: { ...lastImageBlockAttrs(props), ...attrs },
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

export default ImageBlock;
