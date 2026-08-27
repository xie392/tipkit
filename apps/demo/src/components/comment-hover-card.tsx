"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MessageSquare } from "lucide-react";

/**
 * 评论悬浮卡片（语雀/飞书风格）：
 * - 鼠标 hover 在 .tk-comment 高亮文字上时，在文字上方浮出一个小卡片，显示评论内容预览
 * - 点击卡片内的"查看"按钮才打开右侧抽屉面板
 * - 点击评论文字本身 → 正常放置光标编辑（不弹卡片、不打开抽屉）
 *
 * 与 BlockCommentHover 一样，用 createPortal 挂到 body，避免被祖先 overflow/transform 影响。
 */

type HoverState = {
  commentId: string;
  x: number;
  y: number;
  /** 卡片显示方向：above = 卡片在文字上方；below = 卡片在文字下方 */
  placement: "above" | "below";
};

export interface CommentHoverCardProps {
  editor: Editor | null;
  /** 根据 commentId 取评论数据；返回 null 表示该 id 暂无评论（可能是 pending） */
  getComment: (id: string) => {
    author: string;
    text: string;
    createdAt: number;
    replyCount?: number;
  } | null;
  /** 点击卡片内"查看/展开"按钮：由消费方打开右侧抽屉面板 */
  onOpenPanel: (commentId: string) => void;
  /** i18n 文本 */
  text?: { view?: string; reply?: string };
}

export function CommentHoverCard({
  editor,
  getComment,
  onOpenPanel,
  text,
}: CommentHoverCardProps) {
  const [state, setState] = useState<HoverState | null>(null);
  const stateRef = useRef<HoverState | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearLeaveTimer = () => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const scheduleHide = useCallback((delay = 120) => {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => {
      // 若鼠标已移到卡片上，则不隐藏
      const card = cardRef.current;
      if (card && card.matches(":hover")) return;
      setState(null);
    }, delay);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const view = editor.view;
    if (!view) return;
    const pmDom = view.dom as HTMLElement;

    const isOverCard = (clientX: number, clientY: number, pad = 8) => {
      const card = cardRef.current;
      if (!card) return false;
      const r = card.getBoundingClientRect();
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    };

    const findCommentEl = (target: EventTarget | null) => {
      const el = (target as HTMLElement | null)?.closest(".tk-comment") as HTMLElement | null;
      if (!el) return null;
      if (!pmDom.contains(el)) return null;
      return el;
    };

    const handleMove = (e: MouseEvent) => {
      // 鼠标在卡片热区内 → 保持显示
      if (isOverCard(e.clientX, e.clientY)) {
        clearLeaveTimer();
        return;
      }
      const el = findCommentEl(e.target);
      if (!el) {
        scheduleHide(80);
        return;
      }
      const id = el.getAttribute("data-comment-id");
      if (!id) {
        scheduleHide(80);
        return;
      }
      clearLeaveTimer();
      const rect = el.getBoundingClientRect();
      // 估算卡片高度（约 120px），判断上方是否放得下
      const estimateH = 140;
      const showAbove = rect.top > estimateH + 20;
      const midX = rect.left + rect.width / 2;
      // 卡片水平以文字中点为中心（由 CSS translate(-50%, ...) 实现）
      setState({
        commentId: id,
        x: midX,
        y: showAbove ? rect.top : rect.bottom,
        placement: showAbove ? "above" : "below",
      });
    };

    const handleLeave = (e: MouseEvent) => {
      if (!isOverCard(e.clientX, e.clientY)) scheduleHide(80);
    };

    // 滚轮/缩放时隐藏，避免错位
    const hide = () => setState(null);

    pmDom.addEventListener("mousemove", handleMove);
    pmDom.addEventListener("mouseleave", handleLeave);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      clearLeaveTimer();
      pmDom.removeEventListener("mousemove", handleMove);
      pmDom.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [editor, scheduleHide]);

  if (!state || typeof document === "undefined") return null;

  const comment = getComment(state.commentId);

  const tView = text?.view ?? "查看评论";

  return createPortal(
    <div
      ref={cardRef}
      className={`demo-comment-hover-card is-${state.placement}`}
      style={{ left: state.x, top: state.y }}
      onMouseEnter={clearLeaveTimer}
      onMouseLeave={() => scheduleHide(120)}
    >
      {comment ? (
        <>
          <div className="demo-comment-hover-header">
            <span className="demo-comment-avatar">{comment.author.slice(0, 1)}</span>
            <span className="demo-comment-hover-author">{comment.author}</span>
            <span className="demo-comment-hover-reply">
              {comment.replyCount ? `${comment.replyCount} 条回复` : ""}
            </span>
          </div>
          <div className="demo-comment-hover-text">
            {comment.text.length > 140 ? comment.text.slice(0, 140) + "…" : comment.text}
          </div>
          <div className="demo-comment-hover-actions">
            <button
              type="button"
              className="demo-comment-btn primary sm"
              onClick={() => {
                onOpenPanel(state.commentId);
                setState(null);
              }}
            >
              <MessageSquare className="w-3 h-3" />
              {tView}
            </button>
          </div>
        </>
      ) : (
        // 评论还在输入中（pending），只提示
        <div className="demo-comment-hover-text" style={{ color: "var(--muted-foreground)" }}>
          正在输入评论…
        </div>
      )}
    </div>,
    document.body,
  );
}
