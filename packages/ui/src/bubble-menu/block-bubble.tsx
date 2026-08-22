"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { createPortal } from "react-dom";

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

function findPluginState(editor: Editor): number | null {
  const plugin = editor.state.plugins.find((p) => {
    const key = (p as unknown as { key: string }).key;
    return typeof key === "string" && key.indexOf("blockHandles") === 0;
  });
  if (!plugin) return null;
  const state = plugin.getState(editor.state) as { pos: number | null } | undefined;
  return state?.pos ?? null;
}

export function BlockBubbleMenu({ editor }: { editor: Editor }) {
  const [activePos, setActivePos] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => setActivePos(findPluginState(editor));
    update();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  const updatePosition = useCallback(() => {
    if (activePos == null) {
      setCoords(null);
      return;
    }
    const activeEl = editor.view.dom.querySelector<HTMLElement>(".tk-block-active");
    if (!activeEl) {
      setCoords(null);
      return;
    }
    const rect = activeEl.getBoundingClientRect();
    const tb = toolbarRef.current;
    const tbW = tb?.offsetWidth || 90;
    const tbH = tb?.offsetHeight || 34;
    let left = rect.left + rect.width / 2 - tbW / 2;
    const margin = 8;
    if (left < margin) left = margin;
    const vw = window.innerWidth;
    if (left + tbW > vw - margin) left = vw - margin - tbW;
    setCoords({ left, top: rect.top - tbH - 8 });
  }, [activePos, editor]);

  useLayoutEffect(() => {
    updatePosition();
    if (activePos == null) return;
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll, true);
    };
  }, [updatePosition, activePos]);

  if (activePos == null || !coords) return null;

  const duplicate = () => {
    if (activePos == null) return;
    const { doc } = editor.state;
    const $pos = doc.resolve(activePos);
    const node = $pos.nodeAfter;
    if (!node) return;
    editor
      .chain()
      .focus()
      .insertContentAt(activePos + node.nodeSize, node.toJSON())
      .run();
  };

  const remove = () => {
    if (activePos == null) return;
    const { doc } = editor.state;
    const $pos = doc.resolve(activePos);
    const node = $pos.nodeAfter;
    if (!node) return;
    editor.chain().focus().deleteRange({ from: activePos, to: activePos + node.nodeSize }).run();
  };

  return createPortal(
    <div
      ref={toolbarRef}
      className="tk-block-bubble"
      style={{ position: "fixed", left: coords.left, top: coords.top, zIndex: 60 }}
    >
      <button
        type="button"
        title="复制块"
        className="tk-block-bubble-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={duplicate}
      >
        <IconDuplicate />
      </button>
      <span className="tk-block-bubble-divider" />
      <button
        type="button"
        title="删除块"
        className="tk-block-bubble-btn is-danger"
        onMouseDown={(e) => e.preventDefault()}
        onClick={remove}
      >
        <IconTrash />
      </button>
    </div>,
    document.body,
  );
}
