"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MessageSquare } from "lucide-react";
import { useT } from "@tipkit/core";

/**
 * 只读模式划词评论按钮：
 * Tiptap 内置 BubbleMenu 在 editor.isEditable === false 时硬编码不显示
 * （见 @tiptap/extension-bubble-menu bubble-menu-plugin.ts 第 216 行：!this.editor.isEditable 直接 return false），
 * 所以需要自己用原生 selectionchange + mouseup 监听选区，在选区右上角浮一个评论按钮。
 *
 * - 仅在 editor.isEditable === false 时工作
 * - 选中文本后在选区上方浮出 tk-bubble-menu 风格的按钮
 * - 点击按钮通过 view.dispatch 直接派发 addMark transaction（绕过命令 can 检查），
 *   并触发 onCommentCreate 回调
 * - 点击编辑器外 / 选区清空 / 按 Escape 自动隐藏
 */

export interface ReadonlyTextMenuProps {
  editor: Editor | null;
  onCommentCreate?: (range: {
    from: number;
    to: number;
    text: string;
    commentId: string;
  }) => void;
}

export function ReadonlyTextMenu({ editor, onCommentCreate }: ReadonlyTextMenuProps) {
  const t = useT();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rangeRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);

  const updateFromSelection = useCallback(() => {
    if (!editor || editor.isEditable) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const view = editor.view;
    if (!view) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const range = sel.getRangeAt(0);
    const anchorNode = range.startContainer;
    // 选区必须在 ProseMirror DOM 内
    const pmDom = view.dom as HTMLElement;
    if (!pmDom.contains(anchorNode)) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    // 选区不能跨出 ProseMirror
    if (!pmDom.contains(range.endContainer)) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const text = sel.toString();
    if (!text.trim()) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    // 用 posAtCoords 把屏幕坐标转换成 ProseMirror 文档位置（比直接 posAtDOM 更稳妥，自动处理跨节点选区）
    const startPos = view.posAtCoords({ left: rect.left + 2, top: rect.top + 2 });
    const endPos = view.posAtCoords({ left: rect.right - 2, top: rect.top + 2 });
    if (!startPos || !endPos) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const from = Math.min(startPos.pos, endPos.pos);
    const to = Math.max(startPos.pos, endPos.pos);
    if (from === to) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    rangeRef.current = { from, to, text };
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable) {
      setPos(null);
      rangeRef.current = null;
      return;
    }
    const handleMouseUp = () => {
      // 稍微延迟，等 selection 稳定
      setTimeout(updateFromSelection, 10);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
        rangeRef.current = null;
        window.getSelection()?.removeAllRanges();
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      // 点击在按钮本身不隐藏
      if (btnRef.current?.contains(e.target as Node)) return;
      setPos(null);
      // 不清理 rangeRef，等 mouseup 重新计算
    };
    const pmDom = editor.view.dom as HTMLElement;
    pmDom.addEventListener("mouseup", handleMouseUp);
    pmDom.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      pmDom.removeEventListener("mouseup", handleMouseUp);
      pmDom.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, updateFromSelection]);

  // 切换到编辑模式时隐藏
  useEffect(() => {
    if (editor?.isEditable) {
      setPos(null);
      rangeRef.current = null;
    }
  }, [editor?.isEditable]);

  const handleClick = () => {
    if (!editor || !rangeRef.current) return;
    const { from, to, text } = rangeRef.current;
    const commentId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // 只读模式下：通过 view.dispatch 直接派发 addMark transaction（绕过命令层 editable 检查）
    const tr = editor.state.tr;
    const markType = editor.schema.marks.comment;
    if (markType) {
      tr.addMark(from, to, markType.create({ commentId }));
      editor.view.dispatch(tr);
    }
    onCommentCreate?.({ from, to, text, commentId });
    setPos(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!pos || !editor || editor.isEditable || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={btnRef}
      className="tk-bubble-menu readonly-comment-btn"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, calc(-100% - 8px))",
        zIndex: 60,
      }}
      // 阻止 mousedown 清选区
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="tk-bubble-btn"
        title={t("comment.add")}
        aria-label={t("comment.add")}
        onClick={handleClick}
      >
        <MessageSquare className="tk-icon-md" />
      </button>
    </div>,
    document.body,
  );
}
