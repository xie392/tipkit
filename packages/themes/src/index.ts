/**
 * @tipkit/themes —— 内置主题皮肤
 *
 * 主题 = CSS 变量 + 自定义 CSS。消费方项目加载任一主题即可获得完整视觉：
 *
 * ```ts
 * import "@tipkit/themes/default.css";  // shadcn 默认风格
 * // 或
 * import "@tipkit/themes/sketch.css";   // 手绘风格（方格纸 + 手写字体）
 * ```
 *
 * 自定义风格：复制一个主题 CSS 并覆盖变量即可，不需要改任何组件代码。
 */
export interface TipKitTheme {
  id: "default" | "sketch" | string;
  name: string;
  /** 风格描述 */
  description: string;
  /** 引入入口：import "@tipkit/themes/default.css" */
  cssEntry: string;
  /** 是否带自定义字体（需消费方额外引入字体资源） */
  requiresFonts?: boolean;
}

export const themes: TipKitTheme[] = [
  {
    id: "default",
    name: "default",
    description: "shadcn 标准风格：白底深字、系统字体、干净排印",
    cssEntry: "@tipkit/themes/default.css",
  },
  {
    id: "sketch",
    name: "sketch",
    description: "手绘风格：方格纸背景、手写字体、sketch 边框/阴影",
    cssEntry: "@tipkit/themes/sketch.css",
    requiresFonts: true,
  },
];
