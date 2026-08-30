/**
 * @tipkit/extensions —— TipKit 扩展集
 *
 * 扩展分类：
 * - 基础格式 + Markdown 输入规则 + 序列化（basic.ts / markdown/）
 * - 斜杠菜单命令（slash-menu/，UI 原语在 @tipkit/ui）
 * - 高级节点：image-block / code-block / katex / attachment / callout /
 *   columns / details / toc-node / block-handles / emoji / iframe /
 *   canvas / comment / status
 *
 * 规范：
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
export { Status } from "./status/status";
export type { StatusAttrs } from "./status/status";
export { Callout, CALLOUT_VARIANTS } from "./callout/callout";
export type { CalloutVariant } from "./callout/callout";
export { Columns, Column, ColumnLayout } from "./columns/columns";
export { Details, DetailsSummary, DetailsContent } from "./details/details";
export { TableOfContentsNode } from "./toc/toc-node";
export { Iframe } from "./iframe/iframe";
export type { IframeAttrs } from "./iframe/iframe";
export { Attachment } from "./attachment/attachment";
export type { AttachmentAttrs } from "./attachment/attachment";
export { Video } from "./video/video";
export type { VideoAttrs } from "./video/video";
export { BlockHandles, blockHandlesKey, getActiveBlockPos } from "./block-handles/block-handles";
export { FileHandler } from "./file-handler/file-handler";
export type { FileHandlerOptions } from "./file-handler/file-handler";
export { emojisToName, emojiSearch, emojiFilter, emojiByGroup, emojiLibrary, EMOJI_GROUPS, COMMON_EMOJI_COUNT } from "./emoji/emoji-data";
export type { EmojiEntry, EmojiGroup } from "./emoji/emoji-data";

// Emoji（inline 节点 + 短代码输入规则；建议浮层在 @tipkit/ui）
export { Emoji, findEmoji } from "./emoji/emoji-node";
export type { EmojiAttrs, EmojiOptions } from "./emoji/emoji-node";
export { EmojiSuggestion, getEmojiSuggestionState } from "./emoji/emoji-suggestion";

// UniqueID（opt-in：节点自动 id，用于评论锚点/协同定位/目录跳转）
export { UniqueID, uniqueIdKey } from "./unique-id/unique-id";
export type { UniqueIDOptions, UniqueIdOptions } from "./unique-id/unique-id";

// AI 生成（headless 命令层；UI 浮层 AiMenu 在 @tipkit/ui，provider 走 EditorDeps.ai）
export { AiGeneration, aiKey } from "./ai/ai-generation";
export type { AiRunOptions, AiMode, AiGenerationOptions } from "./ai/ai-generation";

// Comment（划词评论）
export { Comment } from "./comment/comment";
export type { CommentOptions } from "./comment/comment";

// Canvas（画板）
export { Canvas } from "./canvas/canvas";
export type { CanvasAttrs } from "./canvas/canvas";
export type { CanvasShape, CanvasView, CanvasTool, Point, Bounds } from "./canvas/canvas-types";

// Footnotes（脚注：正文引用 + 文末条目容器；参考 tiptap-footnotes）
export { FootnoteReference, FootnoteItem, Footnotes, createFootnoteExtensions } from "./footnotes/footnotes";
export type { FootnoteReferenceAttrs, FootnoteItemAttrs, SetFootnoteOptions } from "./footnotes/footnotes";

// SearchAndReplace（查找替换：装饰高亮 + 替换命令；参考 tiptap-search-and-replace）
export { SearchAndReplace, searchAndReplaceKey } from "./search-and-replace/search-and-replace";
export type { SearchMatch, SearchAndReplaceState } from "./search-and-replace/search-and-replace";

// LanguageTool（语法检查：检查函数可注入，缺省走公共 API；参考 tiptap-languagetool）
export { LanguageTool, languageToolKey, languageToolMetaKey, collectTextSegments, mapMatchToDoc } from "./languagetool/languagetool";
export type {
  LanguageToolMatch,
  PositionedLanguageToolMatch,
  LanguageToolState,
  LanguageToolChecker,
  LanguageToolOptions,
} from "./languagetool/languagetool";


// TableReadonlyResize（表格只读列宽拖拽；内置 columnResizing 仅编辑态生效）
export { TableReadonlyResize, tableReadonlyResizeKey } from "./table-readonly-resize/table-readonly-resize";
