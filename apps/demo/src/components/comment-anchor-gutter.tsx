"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MessageSquare } from "lucide-react";

/**
 * 语雀/飞书风格的"评论锚点图标"：
 * - 页面上每个评论标记（.tk-comment）在其所在行的右外侧 gutter 里显示一个小评论图标
 * - 图标不压文字，而是在正文右侧的留白区域内（通过给 ProseMirror 加 padding-right 留出空间）
 * - 点击图标打开该评论的抽屉面板
 * - 滚动/窗口变化时重新计算位置
 */

export interface CommentAnchorGutterProps {
  editor: Editor | null;
  /** 点击锚点图标时，定位到该评论并打开面板 */
  onAnchorClick: (commentId: string) => void;
  /** 已存在的评论 id 集合（只对这些 id 渲染锚点；pending 的不显示） */
  existingIds: Set<string>;
  /** 锚点水平偏移：相对 ProseMirror 容器右边缘向左多少 px（正数 = 在容器内右 padding 区） */
  offsetX?: number;
}

interface AnchorItem {
  id: string;
  x: number;
  y: number;
}

export function CommentAnchorGutter({
  editor,
  onAnchorClick,
  existingIds,
  offsetX = 28,
}: CommentAnchorGutterProps) {
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const rafRef = useRef<number | null>(null);

  const update = useCallback(() => {
    if (!editor) return;
    const view = editor.view;
    if (!view) return;
    const pmDom = view.dom as HTMLElement;
    // 以 ProseMirror 自身右边界为准（适配大屏居中布局）
    const containerRect = pmDom.getBoundingClientRect();
    // 锚点 x：容器右边缘向左 offsetX，正好落在 padding-right 留出的 gutter 里
    const anchorX = containerRect.right - offsetX;

    const items: AnchorItem[] = [];
    const seen = new Set<string>();
    const marks = pmDom.querySelectorAll<HTMLElement>("[data-comment-id]");
    marks.forEach((el) => {
      const id = el.getAttribute("data-comment-id");
      if (!id || seen.has(id)) return;
      if (!existingIds.has(id)) return; // pending 不显示
      seen.add(id);
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return; // 不在视口内
      items.push({
        id,
        x: anchorX,
        y: r.top + 2, // 贴行顶对齐，和文字第一行齐平
      });
    });
    setAnchors(items);
  }, [editor, existingIds, offsetX]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    if (!editor) return;
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    // 监听编辑器内容变化（评论标记增删）
    const view = editor.view;
    const dom = view?.dom;
    if (dom) {
      const obs = new MutationObserver(scheduleUpdate);
      obs.observe(dom, { attributes: true, subtree: true, attributeFilter: ["data-comment-id", "class"] });
      return () => {
        obs.disconnect();
        window.removeEventListener("scroll", scheduleUpdate, true);
        window.removeEventListener("resize", scheduleUpdate);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }
    return () => {
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, scheduleUpdate]);

  // 现有评论 id 变化时也要刷新
  useEffect(() => {
    scheduleUpdate();
  }, [existingIds, scheduleUpdate]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {anchors.map((a) => (
        <button
          key={a.id}
          type="button"
          className="demo-comment-anchor"
          title="查看评论"
          style={{ left: a.x, top: a.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAnchorClick(a.id)}
        >
          <MessageSquare className="demo-comment-anchor-icon" />
        </button>
      ))}
    </>,
    document.body,
  );
}
