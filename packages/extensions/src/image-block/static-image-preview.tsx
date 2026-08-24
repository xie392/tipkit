"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ImagePreview } from "./image-preview";

/* 静态内容图片预览：详情页用 dangerouslySetInnerHTML 渲染纯静态 HTML、未挂载
 * Tiptap 编辑器时，NodeView 里的点击预览不可用。本组件用事件委托为容器内所有
 * <img>（image-block 或普通 prose 图片）绑定点击预览，复用 ImagePreview 弹层。
 *
 * 用法：
 * <StaticImagePreview>
 *   <div className="tk-prosemirror" dangerouslySetInnerHTML={{ __html: html }} />
 * </StaticImagePreview>
 */
export function StaticImagePreview({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt?: string } | null>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.tagName !== "IMG") return;
    const img = target as HTMLImageElement;
    if (!img.src) return;
    // 编辑器内图片由 NodeView 自身处理预览，避免重复触发
    if (img.closest(".ProseMirror")) return;
    e.preventDefault();
    setPreview({ src: img.currentSrc || img.src, alt: img.alt });
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [handleClick]);

  return (
    <div ref={containerRef}>
      {children}
      {preview && (
        <ImagePreview
          src={preview.src}
          alt={preview.alt}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export default StaticImagePreview;
