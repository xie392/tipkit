/**
 * @tipkit/ui —— TipKit 无头 UI 原语
 *
 * 职责：编辑器交互层的行为与布局（定位、键盘导航、激活态计算），
 * 禁止输出颜色/字体/阴影/边框等视觉样式。
 *
 * 迁移状态：
 * - [M2] slash-menu/ SlashMenu（定位、键盘导航、portal，语义类名 tk-slash-*）
 * - [M3] emoji/ EmojiSuggestion（: 触发浮层 + 键盘导航）
 * - [待迁移] bubble-menu/ 选中文字浮层（链接气泡、文本工具条）
 * - [待迁移] block-handles UI（插件逻辑已在 @tipkit/extensions）
 * - [待迁移] table-controls 表格控制条逻辑
 * - [待迁移] toc-panel/ 目录面板逻辑（消费 OutlineItem）
 *
 * 视觉组件（Button/Popover/DropdownMenu 等）在 @tipkit/components；
 * 主题皮肤在 @tipkit/themes。
 */
export { SlashMenu } from "./slash-menu/slash-menu";
export type { SlashMenuProps } from "./slash-menu/slash-menu";
export { EmojiSuggestion, getEmojiSuggestionState } from "./emoji/emoji-suggestion";
export { TextMenu } from "./bubble-menu/text-menu";
export { LinkBubble } from "./bubble-menu/link-bubble";
export { LinkDialog, LinkDialogHost, openLinkDialog } from "./bubble-menu/link-dialog";
export { BlockBubbleMenu } from "./bubble-menu/block-bubble";
export { TablePicker, TableBubbleToolbar, TableContextMenu, TableControls } from "./table-controls";

// 工具栏菜单（完整版）
export { ToolbarBtn } from "./toolbar/toolbar-button";
export { BlockStyleMenu, BLOCK_STYLES } from "./toolbar/block-style-menu";
export { AlignMenu } from "./toolbar/align-menu";
export { FontFamilyPicker, FontSizePicker } from "./toolbar/font-menu";
export { ColorMenu } from "./toolbar/color-menu";
