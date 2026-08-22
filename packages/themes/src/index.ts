/**
 * @tipkit/themes —— 内置主题皮肤
 *
 * 主题 = CSS 变量 + 自定义 CSS。消费方项目加载任一主题即可获得完整视觉：
 *
 * ```ts
 * import "@tipkit/themes/devkb.css";  // devkb 风格（shadcn 默认）
 * // 或
 * import "@tipkit/themes/blog.css";   // blog 手绘线框风格
 * ```
 *
 * 自定义风格：复制一个主题 CSS 并覆盖变量即可，不需要改任何组件代码。
 */
export interface TipKitTheme {
  id: "devkb" | "blog" | string;
  name: string;
  /** 风格描述 */
  description: string;
  /** 引入入口：import "@tipkit/themes/devkb.css" */
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
    id: "devkb",
    name: "devkb",
    description: "常规 shadcn 风格：默认 CSS 变量 + 系统字体",
    cssEntry: "@tipkit/themes/devkb.css",
  },
  {
    id: "blog",
    name: "blog",
    description: "手绘线框风格：方格纸背景、手写字体、sketch 边框",
    cssEntry: "@tipkit/themes/blog.css",
    requiresFonts: true,
  },
];
