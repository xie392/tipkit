"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MessageSquare } from "lucide-react";

/**
 * 只读模式下，鼠标 hover 到段落/标题/列表项等"块"时，
 * 在白纸右侧 gutter 区域显示一个评论图标（fixed 定位，与飞书/语雀一致）。
 *
 * 实现：
 * 1. 全局监听 mousemove（按钮 portal 到 body，离开 pmDom 时仍能触发），找到最近的块级祖先
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
  ".tk-image-block",
  "[data-type='image-block']",
  ".tk-columns",
  "details",
].join(",");

/**
 * 容器型块：内部往往再嵌套 p/li 等块（表格单元格、分栏、折叠块内容、代码块、图片块）。
 * hover 到这些容器内部时，应把整块作为一个整体评论，而不是命中内层的 p/li 导致按钮跳来跳去。
 */
const CONTAINER_SELECTOR = [
  "table",
  ".tk-columns",
  "details",
  ".tk-image-block",
  "pre",
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
  /** 最近一次显示按钮所在块的"保持热区"：鼠标在此区域内移动（含移向按钮途中）不隐藏，避免引用块等块提前消失 */
  const keepZoneRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);

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
      const { clientX, clientY } = e;
      // 1) 光标在按钮热区内 → 保持显示（按钮 portal 到 body，光标移向按钮时也不能提前隐藏）
      if (isOverBtn(clientX, clientY)) return;

      // 2) 光标在 pmDom 内的某个块上 → 在该块位置显示按钮
      const el = (e.target as HTMLElement | null)?.closest(BLOCK_SELECTOR) as HTMLElement | null;
      if (el && pmDom.contains(el)) {
        // 若命中的是容器块内部的块（表格单元格/分栏/折叠块内容等），提升到外层容器，
        // 让整块作为整体评论，按钮固定在容器顶部，避免随内部行/格跳来跳去
        const container = el.closest(CONTAINER_SELECTOR);
        const target =
          container && pmDom.contains(container) && container !== el ? container : el;
        const rect = target.getBoundingClientRect();
        if (rect.top < 90 || rect.bottom > window.innerHeight - 20) {
          keepZoneRef.current = null;
          setPos(null);
          return;
        }
        // 该块已包含评论 → 不显示块评论按钮（右侧已有锚点图标，避免重复）
        if (target.querySelector("[data-comment-id]")) {
          keepZoneRef.current = null;
          setPos(null);
          return;
        }
        // 计算整块文本范围：posAtDOM 返回的是块内部内容起始位置，
        // 需按 node 起始位置解析后再 ±1 得到完整文本区间，避免漏掉首字符
        const raw = view.posAtDOM(target, 0);
        const $pos = view.state.doc.resolve(raw);
        let nodePos: number | null = null;
        if ($pos.parentOffset === 0 && $pos.nodeAfter && $pos.nodeAfter.isBlock) {
          // posAtDOM 落在块内部内容起点 → 回退 1 得到块起始
          nodePos = raw - 1;
        } else if ($pos.depth > 0) {
          nodePos = $pos.before();
        } else if ($pos.nodeBefore) {
          // 位置解析到文档顶层边界（depth 0，如最后一个块之后）：
          // 此时 $pos.before() 会抛 RangeError，改取前一个块作为目标
          nodePos = raw - $pos.nodeBefore.nodeSize;
        }
        const node = nodePos == null ? null : view.state.doc.nodeAt(nodePos);
        if (nodePos == null || !node) {
          keepZoneRef.current = null;
          setPos(null);
          return;
        }
        const from = nodePos + 1;
        const to = nodePos + node.nodeSize - 1;
        let text = target.textContent?.trim() ?? "";
        if (text.length > 80) text = text.slice(0, 80) + "…";
        // 按钮放到 ProseMirror 正文右外侧的 gutter 区（与评论锚点同位置），不压文字
        const pmRect = pmDom.getBoundingClientRect();
        // 记录"保持热区"：覆盖整块垂直范围 + 横向一直到按钮右侧，鼠标从块移向按钮途中不隐藏
        keepZoneRef.current = {
          left: rect.left - 24,
          top: rect.top - 24,
          right: pmRect.right + 24,
          bottom: rect.bottom + 24,
        };
        setPos({
          x: pmRect.right - 28,
          y: rect.top + 6,
          from: Math.min(from, to),
          to: Math.max(from, to),
          text: text || "(整块内容)",
        });
        return;
      }

      // 3) 不在块上：若仍在上一块的"保持热区"内（含移向按钮途中）→ 保持显示
      const kz = keepZoneRef.current;
      if (
        kz &&
        clientX >= kz.left &&
        clientX <= kz.right &&
        clientY >= kz.top &&
        clientY <= kz.bottom
      ) {
        return;
      }
      keepZoneRef.current = null;
      setPos(null);
    };

    // 全局监听 mousemove：按钮 portal 到 document.body（不在 pmDom 内），
    // 只有全局监听才能在光标从块移向按钮、离开 pmDom 的途中持续触发，避免按钮提前消失
    const handleScroll = () => {
      keepZoneRef.current = null;
      setPos(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("scroll", handleScroll, true);
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
