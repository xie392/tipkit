/**
 * @tipkit/editor —— TipKit 聚合入口
 *
 * 消费方只需要：
 * ```tsx
 * import { TipKitEditor } from "@tipkit/editor";
 * import "@tipkit/themes/devkb.css"; // 或 blog.css
 * ```
 */
export { TipKitEditor, buildToolbarGroups } from "./tiptap-editor";
export type { TipKitEditorProps } from "./tiptap-editor";

// re-export 常用类型与 hook，消费方无需感知内部包
export { useTipKitEditor, EditorProvider, useEditorDeps } from "@tipkit/core";
export type {
  ToolbarAction,
  ToolbarOption,
  ToolbarGroup,
  OutlineItem,
  EditorDeps,
  ImageAttrs,
  IconRef,
} from "@tipkit/core";
