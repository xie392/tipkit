/**
 * @tipkit/core —— TipKit 无头核心
 *
 * 零样式。只提供编辑器逻辑、序列化、依赖注入与共享类型。
 */
export { useTipKitEditor } from "./use-editor";
export type { UseTipKitEditorOptions } from "./use-editor";
export { useEditorEditable } from "./use-editor-editable";
export { useToolbarPlacement } from "./use-toolbar-placement";
export type { ToolbarPlacement } from "./use-toolbar-placement";
export { useToolbarVisibility } from "./use-toolbar-visibility";
export { EditorProvider, useEditorDeps, useT } from "./context";
export { createSerializer } from "./serialization";
export { createUploadId, finalizeImageUpload } from "./image-upload";
export type { TipKitSerializer } from "./serialization";
export type {
  ToolbarAction,
  ToolbarOption,
  ToolbarGroup,
  OutlineItem,
  EditorDeps,
  AttachmentMeta,
  ImageAttrs,
  IconRef,
  CommentRange,
  AIStreamRequest,
  AIStreamProvider,
  AIProvider,
} from "./types";

// i18n
export { createT, zh, en } from "./i18n";
export type { Messages, Translate } from "./i18n";
