/**
 * @tipkit/ui —— TipKit 无头 UI 原语
 *
 * 职责：编辑器交互层的行为与布局（定位、键盘导航、激活态计算），
 * 禁止输出颜色/字体/阴影/边框等视觉样式。
 *
 * 交互原语：
 * - slash-menu/ SlashMenu（定位、键盘导航、portal，语义类名 tk-slash-*）
 * - emoji/ EmojiSuggestion（: 触发浮层 + 键盘导航）
 * - bubble-menu/ 选中文字浮层（TextMenu / LinkBubble / BlockBubbleMenu / BlockHandleMenu）
 * - table-controls/ 表格控制条（TableControls / TablePicker / TableBubbleToolbar / TableContextMenu）
 * - toolbar/ 工具栏菜单（BlockStyleMenu / AlignMenu / ColorMenu / FontMenu / ToolbarBtn）
 *
 * 视觉组件（Button/Popover/DropdownMenu 等）在 @tipkit/components；
 * 主题皮肤在 @tipkit/themes。
 */

/* 命令类型增强：本包通过 editor.chain() 调用表格/对齐/高亮/颜色/链接等命令，
 * 其类型声明（declare module "@tiptap/core"）来自各扩展包。这里必须用副作用导入
 * （而非 import type），因为空 type-only 导入会被 tsc 从产出的 .d.ts 中删除，
 * 导致消费方拿不到 Commands 类型增强。 */
import "@tiptap/starter-kit";
import "@tiptap/extension-table";
import "@tiptap/extension-table-row";
import "@tiptap/extension-table-cell";
import "@tiptap/extension-table-header";
import "@tiptap/extension-text-align";
import "@tiptap/extension-highlight";
import "@tiptap/extension-color";
import "@tiptap/extension-font-family";
import "@tiptap/extension-text-style";
import "@tiptap/extension-link";
import "@tiptap/extension-underline";
import "@tipkit/extensions";

export { SlashMenu } from "./slash-menu/slash-menu";
export type { SlashMenuProps } from "./slash-menu/slash-menu";
export { EmojiSuggestion, getEmojiSuggestionState } from "./emoji/emoji-suggestion";
export { AiMenu } from "./ai-menu/ai-menu";
export { TextMenu } from "./bubble-menu/text-menu";
export { ReadonlyTextMenu } from "./bubble-menu/readonly-text-menu";
export type { ReadonlyTextMenuProps } from "./bubble-menu/readonly-text-menu";
export { LinkBubble } from "./bubble-menu/link-bubble";
export { LinkDialog, LinkDialogHost, openLinkDialog } from "./bubble-menu/link-dialog";
export { BlockBubbleMenu } from "./bubble-menu/block-bubble";
export { BlockHandleMenu } from "./bubble-menu/block-handle-menu";
export { TablePicker, TableBubbleToolbar, TableContextMenu, TableControls } from "./table-controls";
export { TableHoverControls } from "./table-hover-controls";

// 工具栏菜单（完整版）
export { ToolbarBtn } from "./toolbar/toolbar-button";
export { BlockStyleMenu, BLOCK_STYLES } from "./toolbar/block-style-menu";
export { AlignMenu } from "./toolbar/align-menu";
export { FontFamilyPicker, FontSizePicker } from "./toolbar/font-menu";
export { ColorMenu } from "./toolbar/color-menu";
