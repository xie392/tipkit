"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MessageSquare } from "lucide-react";

/**
 * 只读模式下，鼠标 hover 到段落/标题/列表项等"块"时，
 * 在白纸右侧 gutter 区域显示一个评论图标（fixed 定位，与飞书/语雀一致）。
 *
 * 实现：
 * 1. 监听 ProseMirror DOM 的 mousemove，找到最近的块级祖先
 * 2. 用 getBoundingClientRect 计算块在视口中的垂直中点，fixed 定位按钮
 * 3. 白纸右边缘 x 坐标通过 ResizeObserver + 滚动实时计算（响应式也正确）
 * 4. 点击：选中块范围 → 调用 commands.setComment 触发评论流程
 */

const BLOCK_SELECTOR = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote > p",
  "pre",
  ".tk-callout",
  ".tk-katex",
  "hr",
  "table",
  "[data-type='image-block']",
  ".tk-columns",
  "details",
].join(",");

type Pos = { x: number; y: number; from: number; to: number; text: string };

export function BlockCommentHover({
  editor,
  enabled,
  onBlockComment,
}: {
  editor: Editor | null;
  enabled: boolean;
  onBlockComment: (from: number, to: number, text: string) => void;
}) {
  const [pos, setPos] = useState<Pos | null>(null);

  const recompute = useCallback(() => {
    if (!editor) return;
    const view = editor.view;
    if (!view) return;
    const pmDom = view.dom as HTMLElement;

    // 取当前按钮 DOM，用于热区检测（鼠标移向按钮途中不消失）
    const getBtnRect = () => {
      const btn = document.querySelector(".tk-block-comment-btn") as HTMLElement | null;
      return btn?.getBoundingClientRect();
    };
    const isOverBtn = (clientX: number, clientY: number, pad = 16) => {
      const r = getBtnRect();
      if (!r) return false;
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    };

    const handleMove = (e: MouseEvent) => {
      // 如果当前悬停在按钮热区内，保持显示
      if (isOverBtn(e.clientX, e.clientY)) return;

      const el = (e.target as HTMLElement | null)?.closest(BLOCK_SELECTOR) as HTMLElement | null;
      if (!el || !pmDom.contains(el)) {
        setPos(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.top < 90 || rect.bottom > window.innerHeight - 20) {
        setPos(null);
        return;
      }
      const posAtDom = view.posAtDOM(el, 0);
      const node = view.state.doc.nodeAt(posAtDom);
      if (!node) {
        setPos(null);
        return;
      }
      const from = posAtDom + 1;
      const to = posAtDom + node.nodeSize - 1;
      let text = el.textContent?.trim() ?? "";
      if (text.length > 80) text = text.slice(0, 80) + "…";
      // 按钮放到 ProseMirror 正文右外侧的 gutter 区（与评论锚点同位置），不压文字
      const pmRect = pmDom.getBoundingClientRect();
      setPos({
        x: pmRect.right - 28,
        y: rect.top + 6,
        from: Math.min(from, to),
        to: Math.max(from, to),
        text: text || "(整块内容)",
      });
    };

    const handleLeave = (e: MouseEvent) => {
      // 离开编辑器 DOM 时，如果不在按钮热区就隐藏
      if (!isOverBtn(e.clientX, e.clientY)) setPos(null);
    };

    pmDom.addEventListener("mousemove", handleMove);
    pmDom.addEventListener("mouseleave", handleLeave);
    window.addEventListener("scroll", () => setPos(null), true);
    return () => {
      pmDom.removeEventListener("mousemove", handleMove);
      pmDom.removeEventListener("mouseleave", handleLeave);
    };
  }, [editor]);

  useEffect(() => {
    if (!enabled || !editor) {
      setPos(null);
      return;
    }
    const cleanup = recompute();
    // 窗口 resize 时重绑以刷新白纸右边缘 x 坐标
    const onResize = () => {
      cleanup?.();
      recompute();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cleanup?.();
      window.removeEventListener("resize", onResize);
    };
  }, [editor, enabled, recompute]);

  if (!enabled || !pos || typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      className="tk-block-comment-btn"
      title="对这一段添加评论"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onBlockComment(pos.from, pos.to, pos.text);
        setPos(null);
      }}
    >
      <MessageSquare className="w-3.5 h-3.5" />
    </button>,
    document.body,
  );
}
