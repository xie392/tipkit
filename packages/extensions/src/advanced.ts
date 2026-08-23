import type { AnyExtension } from "@tiptap/core";
import { ImageBlock } from "./image-block/image-block";
import { CustomCodeBlock } from "./code-block/code-block";
import { Katex } from "./katex/katex";
import { Callout } from "./callout/callout";
import { Columns, Column } from "./columns/columns";
import { Details, DetailsSummary, DetailsContent } from "./details/details";
import { TableOfContentsNode } from "./toc/toc-node";
import { Iframe } from "./iframe/iframe";
import { Attachment } from "./attachment/attachment";
import { BlockHandles } from "./block-handles/block-handles";
import { FileHandler } from "./file-handler/file-handler";

export interface AdvancedExtensionsOptions {
  /**
   * 目录（TOC）点击跳转时，距离滚动容器顶部的像素偏移。
   * 用于避开 sticky header / 工具栏等遮挡元素。
   * @default 0
   */
  tocScrollOffset?: number;
}

/**
 * TipKit 高级扩展集合（M2+M3 全量：图片块/代码块/公式/提示框/分栏/
 * 折叠/目录/嵌入/附件/块句柄/文件拖拽）。
 *
 * 与 createBasicExtensions() 叠加使用：
 * ```ts
 * useTipKitEditor({
 *   extensions: [
 *     ...createBasicExtensions(),
 *     ...createAdvancedExtensions({ tocScrollOffset: 80 }),
 *   ],
 * })
 * ```
 *
 * 说明：
 * - FileHandler 默认未配置上传（退化 base64）；消费方可追加
 *   FileHandler.configure({ onUpload }) 覆盖。
 * - EmojiSuggestion（浮层 UI）在 @tipkit/ui，消费方按需渲染。
 */
export function createAdvancedExtensions(options: AdvancedExtensionsOptions = {}): AnyExtension[] {
  const toc =
    options.tocScrollOffset != null
      ? TableOfContentsNode.configure({ scrollOffset: options.tocScrollOffset })
      : TableOfContentsNode;

  return [
    ImageBlock,
    CustomCodeBlock,
    Katex,
    Callout,
    Columns,
    Column,
    Details,
    DetailsSummary,
    DetailsContent,
    toc,
    Iframe,
    Attachment,
    BlockHandles,
    FileHandler,
  ];
}
