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
import { Video } from "./video/video";
import { BlockHandles } from "./block-handles/block-handles";
import { FileHandler } from "./file-handler/file-handler";
import { Status } from "./status/status";

/** 高级集合内每个扩展的稳定 key（按加入顺序排列） */
export type AdvancedExtensionKey =
  | "imageBlock"
  | "codeBlock"
  | "katex"
  | "callout"
  | "columns"
  | "column"
  | "details"
  | "detailsSummary"
  | "detailsContent"
  | "toc"
  | "iframe"
  | "attachment"
  | "video"
  | "blockHandles"
  | "fileHandler"
  | "status";

export interface AdvancedExtensionsOptions {
  /**
   * 目录（TOC）点击跳转时，距离滚动容器顶部的像素偏移。
   * 用于避开 sticky header / 工具栏等遮挡元素。
   * @default 0
   */
  tocScrollOffset?: number;
  /** 用消费方自己的扩展实例替换集合中的默认项（如换成自研 NodeView 版 Callout） */
  replace?: Partial<Record<AdvancedExtensionKey, AnyExtension>>;
  /** 从集合中移除某些扩展 */
  omit?: AdvancedExtensionKey[];
  /** 追加到集合末尾的扩展 */
  extra?: AnyExtension[];
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
 * 替换 / 裁剪集合内默认项：
 * ```ts
 * createAdvancedExtensions({
 *   replace: { callout: MyCallout },
 *   omit: ["video"],
 *   extra: [MyExtension],
 * })
 * ```
 *
 * 说明：
 * - FileHandler 默认未配置上传（退化 base64）；消费方可 replace 换成
 *   FileHandler.configure({ onUpload }) 覆盖。
 * - EmojiSuggestion（浮层 UI）在 @tipkit/ui，消费方按需渲染。
 */
export function createAdvancedExtensions(options: AdvancedExtensionsOptions = {}): AnyExtension[] {
  const { tocScrollOffset = 0, replace = {}, omit = [], extra = [] } = options;
  // 每次调用都产出全新扩展实例：模块级单例的 storage 等实例状态
  // 会跨编辑器共享，多编辑器同屏时会互相串状态，不能缓存复用。
  const built = buildAdvancedExtensions(
    TableOfContentsNode.configure({ scrollOffset: tocScrollOffset }),
  );
  // 替换项沿用原 key 的位置，保证扩展注册顺序不变
  for (const key of Object.keys(replace) as AdvancedExtensionKey[]) {
    const ext = replace[key];
    if (ext) built[key] = ext;
  }
  for (const key of omit) delete built[key];
  return [...Object.values(built), ...extra];
}

function buildAdvancedExtensions(toc: AnyExtension): Record<AdvancedExtensionKey, AnyExtension> {
  return {
    imageBlock: ImageBlock,
    codeBlock: CustomCodeBlock,
    katex: Katex,
    callout: Callout,
    columns: Columns,
    column: Column,
    details: Details,
    detailsSummary: DetailsSummary,
    detailsContent: DetailsContent,
    toc,
    iframe: Iframe,
    attachment: Attachment,
    video: Video,
    blockHandles: BlockHandles,
    fileHandler: FileHandler,
    status: Status,
  };
}
