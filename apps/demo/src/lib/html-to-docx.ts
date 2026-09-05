/* Demo 内置的「编辑器 DOM → docx」转换器（纯前端，读计算样式）。
 * 按职责拆分：docx-colors（颜色换算）/ docx-runs（行内样式与链接）/
 * docx-media（图片/SVG/Canvas）/ docx-blocks（块级映射与 buildDocx 入口） */
export { buildDocx } from "./docx-blocks";
export { cssColorToHex } from "./docx-colors";
