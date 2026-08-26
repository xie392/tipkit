/**
 * @tipkit/editor —— TipKit 聚合入口
 *
 * 消费方只需要：
 * ```tsx
 * import { TipKitEditor } from "@tipkit/editor";
 * import "@tipkit/themes/default.css"; // 或 sketch.css
 * ```
 */

/* 命令类型增强：buildToolbarGroups 通过 editor.chain() 调用标题/列表/表格/对齐/
 * 高亮等命令，其 Commands 声明来自对应 @tiptap 扩展包。必须用副作用导入（而非
 * import type），否则 tsc 会在产出的 .d.ts 中删除空导入，消费方拿不到类型增强。 */
import "@tiptap/starter-kit";
import "@tiptap/extension-table";
import "@tiptap/extension-text-align";
import "@tiptap/extension-highlight";
import "@tiptap/extension-color";
import "@tiptap/extension-link";
import "@tiptap/extension-underline";
import "@tiptap/extension-subscript";
import "@tiptap/extension-superscript";

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
  CommentRange,
} from "@tipkit/core";
