/**
 * @tipkit/extensions —— TipKit 扩展集
 *
 * 迁移状态：
 * - [M1 已完成] 基础格式 + markdown 输入规则 + 序列化（basic.ts）
 *   - safe-mark-input-rule / marks（行内 md 规则）
 *   - link（[文字](url) 与裸 URL）
 *   - paste（Markdown 粘贴）
 *   - list-input-rules / trailing-node / selection / font-size
 * - [待迁移] 高级扩展（从 blog rich-text 迁移，按 P0-P2）：
 *   - [P0] slash-menu/ 斜杠菜单（suggestion 数据 + 命令，UI 原语在 @tipkit/ui）
 *   - [P0] image-block/ 图片块（宽度调节、对齐、样式、悬停工具条）
 *   - [P0] code-block/ 代码块低亮高亮（code-block-lowlight + 语言选择）
 *   - [P1] katex/ 公式节点（渲染经 EditorDeps.renderKatex 注入，支持 SSR）
 *   - [P1] attachment/ 附件节点（上传经 EditorDeps.uploadAttachment）
 *   - [P1] callout/ 提示块
 *   - [P1] columns/ 分栏（columns-menu）
 *   - [P1] details/ 折叠块
 *   - [P1] toc-node/ 目录节点（配合 core OutlineItem）
 *   - [P1] block-handles/ 块句柄（拖拽/悬停工具条，UI 原语在 @tipkit/ui）
 *   - [P1] emoji/ emoji 建议 + 选择器
 *   - [P2] iframe/ 嵌入节点
 *   - [P2] link-card/ 链接卡片
 *   - [P2] table-controls 表格控制条
 *
 * 迁移规范：
 * 1. 纯逻辑：扩展内只做 ProseMirror/Tiptap 行为，不渲染视觉 DOM
 * 2. 语义类名：需要样式的节点只加 `tk-*` 语义类名，禁止视觉类名（sketch-* 等）
 * 3. 依赖注入：上传/存储/katex 一律从 @tipkit/core 的 useEditorDeps() 读取
 */
export { createBasicExtensions } from "./basic";
export { createAdvancedExtensions } from "./advanced";

// M1：基础扩展
export { safeMarkInputRule } from "./markdown/safe-mark-input-rule";
export { CustomBold, CustomItalic, CustomStrike, CustomCode } from "./markdown/marks";
export { MarkdownLink } from "./markdown/link";
export { LinkBackfillConvert } from "./markdown/link-backfill-convert";
export { CodeBackfillConvert } from "./markdown/code-backfill-convert";
export { MarkdownPaste } from "./markdown/paste";
export { ListInputRules } from "./markdown/list-input-rules";
export { TrailingNode } from "./basic/trailing-node";
export { Selection } from "./basic/selection";
export { FontSize } from "./basic/font-size";
export { CustomHorizontalRule } from "./basic/horizontal-rule";

// M2：斜杠菜单命令 + 图片块 + 代码块
export {
  getInsertActions,
  getSlashCommandState,
  replaceSlashWithEmpty,
  filterInsertActions,
  getSlashGroupLabel,
  SLASH_GROUP_ORDER,
} from "./slash-menu/actions";
export type { InsertAction, SlashCommandState, GetInsertActionsOptions } from "./slash-menu/actions";
export { ImageBlock } from "./image-block/image-block";
export type { ImageBlockAttrs, ImageStyleType } from "./image-block/image-block";
export { ImagePreview } from "./image-block/image-preview";
export type { ImagePreviewProps } from "./image-block/image-preview";
export { StaticImagePreview } from "./image-block/static-image-preview";
export { CustomCodeBlock, CODE_LANGUAGES } from "./code-block/code-block";
export type { CodeBlockTheme, CodeLanguage } from "./code-block/code-block";

// M3：高级节点
export { Katex } from "./katex/katex";
export type { KatexAttrs } from "./katex/katex";
export { Callout, CALLOUT_VARIANTS } from "./callout/callout";
export type { CalloutVariant } from "./callout/callout";
export { Columns, Column, ColumnLayout } from "./columns/columns";
export { Details, DetailsSummary, DetailsContent } from "./details/details";
export { TableOfContentsNode } from "./toc/toc-node";
export { Iframe } from "./iframe/iframe";
export type { IframeAttrs } from "./iframe/iframe";
export { Attachment } from "./attachment/attachment";
export type { AttachmentAttrs } from "./attachment/attachment";
export { BlockHandles, blockHandlesKey, getActiveBlockPos } from "./block-handles/block-handles";
export { FileHandler } from "./file-handler/file-handler";
export type { FileHandlerOptions } from "./file-handler/file-handler";
export { emojisToName } from "./emoji/emoji-data";
