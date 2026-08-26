"use client";

import { useInsertionEffect } from "react";

/**
 * 主题初始化脚本：在首屏渲染前从 localStorage 读取主题并设置 class。
 * 用 useInsertionEffect 在 layout 计算前执行，最大程度避免闪烁。
 *
 * 为什么不直接在 layout.tsx 里写 <script>：
 * React 19 会对组件内的 <script> 标签发出警告
 * （"Encountered a script tag while rendering React component"）。
 */
export function ThemeScript() {
  useInsertionEffect(() => {
    try {
      const t = localStorage.getItem("tipkit-site-theme");
      const valid = ["default", "sketch", "dark"];
      const v = valid.includes(t as string) ? t : "default";
      document.documentElement.classList.add(`tk-theme-${v}`);
    } catch {
      document.documentElement.classList.add("tk-theme-default");
    }
  }, []);

  return null;
}
