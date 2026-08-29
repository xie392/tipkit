"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { emojiFilter, emojiByGroup, EMOJI_GROUPS } from "@tipkit/extensions";

/* Emoji 建议浮层。
 * 输入 :xxx 触发，方向键选择，Enter/Tab 插入。视觉归主题（tk-emoji-*）。
 * 注意：浮层直接由编辑器状态驱动渲染（不再用 FloatingMenu 插件），
 * 保证"浮层可见性"与"键盘插入"使用同一状态源——
 * 否则斜杠菜单插入 ":" 后插件未显示浮层、Enter 仍会盲插默认表情。 */

interface EmojiSuggestionState {
  active: boolean;
  query: string;
  from: number;
  to: number;
}

const INACTIVE: EmojiSuggestionState = {
  active: false,
  query: "",
  from: 0,
  to: 0,
};

const COLS = 8;
const MENU_WIDTH = 286;
const MENU_HEIGHT = 300;

export function getEmojiSuggestionState(editor: Editor): EmojiSuggestionState {
  const { state } = editor;
  const { $anchor, empty } = state.selection;
  if (!empty) return INACTIVE;

  const node = $anchor.parent;
  if (!node.isTextblock) return INACTIVE;

  const textBefore = node.textBetween(0, $anchor.parentOffset, "\n", "\n");
  const match = textBefore.match(/(^|\s):([a-z0-9_+-]*)$/i);
  if (!match) return INACTIVE;

  const query = match[2];
  const colonOffset = match.index! + match[1].length;
  const from = $anchor.start() + colonOffset;
  const to = $anchor.pos;

  return { active: true, query, from, to };
}

export function EmojiSuggestion({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<EmojiSuggestionState>(INACTIVE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [group, setGroup] = useState("common");
  const [pos, setPos] = useState<{ top: number; left: number; placement: "bottom" | "top" } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      setState(getEmojiSuggestionState(editor));
      setActiveIndex(0);
    };
    sync();
    editor.on("update", sync);
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("update", sync);
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  // 光标定位：跟随 : 所在位置，视口内自动翻转/夹紧；滚动时重算
  useEffect(() => {
    if (!editor || !state.active) {
      setPos(null);
      return;
    }
    const compute = () => {
      try {
        const coords = editor.view.coordsAtPos(state.from);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.min(Math.max(8, coords.left), Math.max(8, vw - MENU_WIDTH - 8));
        const below = coords.bottom + MENU_HEIGHT + 8 < vh;
        const top = below ? coords.bottom + 4 : Math.max(8, coords.top - MENU_HEIGHT - 4);
        const placement = below ? "bottom" : "top";
        setPos((prev) =>
          prev && prev.top === top && prev.left === left && prev.placement === placement
            ? prev
            : { top, left, placement },
        );
      } catch {
        /* pos 已失效（文档变化中），等待下一次 sync */
      }
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [editor, state.active, state.from]);

  // 键盘导航时高亮项跟随滚动（scrollIntoView 会连带滚动页面，这里只滚网格容器）
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const active = grid.querySelector(".tk-emoji-cell[data-active]");
    if (!active) return;
    const gridRect = grid.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const top = rect.top - gridRect.top + grid.scrollTop;
    const bottom = top + rect.height;
    if (top < grid.scrollTop) {
      grid.scrollTop = top;
    } else if (bottom > grid.scrollTop + grid.clientHeight) {
      grid.scrollTop = bottom - grid.clientHeight;
    }
  }, [activeIndex, group, state.query]);

  const insert = useCallback(
    (item: { name: string; emoji: string }) => {
      if (!editor) return;
      const current = stateRef.current;
      if (!current.active) return;
      // 注册了 Emoji 节点扩展时插入节点（可序列化 :name:），否则退回纯文本
      const content = editor.schema.nodes.emoji
        ? { type: "emoji", attrs: { name: item.name, glyph: item.emoji } }
        : item.emoji;
      editor
        .chain()
        .focus()
        .deleteRange({ from: current.from, to: current.to })
        .insertContent(content)
        .insertContent(" ")
        .run();
    },
    [editor],
  );

  const filtered = state.query.trim() ? emojiFilter(state.query) : emojiByGroup(group);
  const filteredCount = filtered.length;

  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // 输入法组合期（拼音候选确认）的按键不触发选择/插入
      if (event.isComposing || event.keyCode === 229) return;
      const current = stateRef.current;
      if (!current.active || filteredCount === 0) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % filteredCount);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + filteredCount) % filteredCount);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        // 按列数跳格；只剩一行（过滤后常用场景）时退化为逐个移动，与斜杠菜单习惯一致
        setActiveIndex((i) => {
          const next = i + COLS;
          return next < filteredCount ? next : i + 1 < filteredCount ? i + 1 : i;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => {
          const prev = i - COLS;
          if (prev >= 0) return prev;
          return i - 1 >= 0 ? i - 1 : i;
        });
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const items = filtered;
        insert(items[Math.min(activeIndex, items.length - 1)]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setState(INACTIVE);
      }
    };
    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
  }, [activeIndex, filteredCount, editor, insert, state.query]);

  if (!editor || !state.active || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="tk-emoji-menu"
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      data-placement={pos.placement}
    >
      <div className="tk-emoji-panel">
        <div ref={gridRef} className="tk-emoji-grid">
          {filtered.map((item, idx) => (
            <button
              key={`${idx}-${item.name}`}
              type="button"
              title={`:${item.name}:`}
              data-active={activeIndex === idx || undefined}
              onClick={() => insert(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              className="tk-emoji-cell"
            >
              {item.emoji}
            </button>
          ))}
        </div>
        <div className="tk-emoji-tabs">
          {EMOJI_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`tk-emoji-tab${group === g.id ? " is-active" : ""}`}
              onClick={() => {
                setGroup(g.id);
                setActiveIndex(0);
              }}
            >
              {g.icon}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EmojiSuggestion;
