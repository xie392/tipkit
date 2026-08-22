"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  filterInsertActions,
  getInsertActions,
  getSlashCommandState,
  type InsertAction,
  type SlashCommandState,
} from "@tipkit/extensions";

export interface SlashMenuProps {
  editor: Editor | null;
  onUploadImage?: (file: File) => Promise<string>;
  iconRenderer?: (icon: string) => React.ReactNode;
}

const INACTIVE: SlashCommandState = {
  active: false,
  query: "",
  from: 0,
  to: 0,
  key: "",
};

const MENU_WIDTH = 288;
const PREVIEW_WIDTH = 200;
const PREVIEW_GAP = 8;
const MENU_MAX_HEIGHT = 340;
const OFFSET = 8;

export function SlashMenu({ editor, onUploadImage, iconRenderer }: SlashMenuProps) {
  const [slash, setSlash] = useState<SlashCommandState>(INACTIVE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKey, setHiddenKey] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [previewPos, setPreviewPos] = useState<{ top: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ slash, activeIndex, actions: [] as InsertAction[] });

  const allActions = useMemo(
    () =>
      editor
        ? getInsertActions({
            editor,
            openImagePicker: onUploadImage ? () => fileRef.current?.click() : undefined,
            clearSlashQuery: true,
          })
        : [],
    [editor, onUploadImage],
  );
  const actions = useMemo(
    () => filterInsertActions(allActions, slash.query),
    [allActions, slash.query],
  );
  stateRef.current = { slash, activeIndex, actions };

  const updatePosition = useCallback(() => {
    if (!editor) return;
    const currentSlash = getSlashCommandState(editor);
    if (!currentSlash.active || hiddenKey === currentSlash.key) {
      setPos(null);
      return;
    }
    const coords = editor.view.coordsAtPos(currentSlash.from);
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = coords.bottom + OFFSET;
    let left = coords.left;

    const menuH = menuRef.current?.offsetHeight || MENU_MAX_HEIGHT;
    const menuW = MENU_WIDTH;
    if (top + menuH > vh - 12) {
      top = coords.top - menuH - OFFSET;
    }
    if (top < 8) {
      top = Math.max(8, vh - menuH - 12);
    }
    if (left + menuW > vw - 12) {
      left = vw - menuW - 12;
    }
    if (left < 12) left = 12;

    setPos({ top, left });
  }, [editor, hiddenKey]);

  useEffect(() => {
    if (!editor) return;
    const syncSlash = () => {
      setSlash(getSlashCommandState(editor));
      setActiveIndex(0);
      requestAnimationFrame(updatePosition);
    };
    syncSlash();
    editor.on("update", syncSlash);
    editor.on("selectionUpdate", syncSlash);
    return () => {
      editor.off("update", syncSlash);
      editor.off("selectionUpdate", syncSlash);
    };
  }, [editor, updatePosition]);

  useEffect(() => {
    if (!slash.active || hiddenKey === slash.key) {
      setPos(null);
      return;
    }
    requestAnimationFrame(updatePosition);

    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [slash.active, slash.key, hiddenKey, updatePosition]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    requestAnimationFrame(() => {
      const listRect = listRef.current!.getBoundingClientRect();
      const itemRect = el.getBoundingClientRect();
      setPreviewPos({ top: itemRect.top - listRect.top });
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const { slash: cur, actions: list } = stateRef.current;
      if (!cur.active || hiddenKey === cur.key || list.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % list.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + list.length) % list.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const action = list[stateRef.current.activeIndex];
        if (action && action.available) action.run();
        setHiddenKey(cur.key);
        setPos(null);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setHiddenKey(cur.key);
        setPos(null);
      }
    };
    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, hiddenKey]);

  useEffect(() => {
    if (!editor) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const currentSlash = getSlashCommandState(editor);
        if (currentSlash.active) setHiddenKey(currentSlash.key);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editor]);

  const isVisible = slash.active && hiddenKey !== slash.key && pos !== null;
  const activeAction = actions[activeIndex] ?? null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage || !editor) return;
    onUploadImage(file).then((src) => {
      editor.chain().focus().setImageBlock({ src }).run();
    });
  };

  const execute = (action: InsertAction) => {
    if (!action.available) return;
    action.run();
    setHiddenKey(slash.key);
    setPos(null);
  };

  let previewLeft = 0;
  let previewTop = 0;
  let showPreview = false;
  if (isVisible && pos && previewPos !== null && activeAction?.preview) {
    const onRight = pos.left + MENU_WIDTH + PREVIEW_GAP + PREVIEW_WIDTH + 16 < window.innerWidth;
    previewLeft = onRight
      ? pos.left + MENU_WIDTH + PREVIEW_GAP
      : pos.left - PREVIEW_WIDTH - PREVIEW_GAP;
    previewTop = Math.min(pos.top + previewPos.top - 4, window.innerHeight - 180);
    showPreview = true;
  }

  const menu = isVisible ? (
    <div
      ref={menuRef}
      className="tk-slash-menu"
      style={{
        position: "fixed",
        top: pos?.top,
        left: pos?.left,
        width: MENU_WIDTH,
        maxHeight: MENU_MAX_HEIGHT,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.preventDefault()}
      role="menu"
    >
      <div ref={listRef} className="tk-slash-menu-list">
        {actions.length === 0 && <div className="tk-slash-menu-empty">没有匹配的命令</div>}
        {actions.map((item, idx) => (
          <SlashItem
            key={item.id}
            item={item}
            active={activeIndex === idx}
            iconRenderer={iconRenderer}
            onHover={() => setActiveIndex(idx)}
            onClick={() => execute(item)}
          />
        ))}
      </div>
      <div className="tk-slash-menu-footer">
        <span>关闭菜单</span>
        <kbd>esc</kbd>
      </div>
    </div>
  ) : null;

  const preview =
    showPreview && activeAction?.preview ? (
      <div
        className="tk-slash-preview"
        style={{
          position: "fixed",
          top: previewTop,
          left: previewLeft,
          width: PREVIEW_WIDTH,
          zIndex: 9998,
          pointerEvents: "none",
        }}
      >
        <div className="tk-slash-preview-card">
          <div
            className="tk-slash-preview-body"
            dangerouslySetInnerHTML={{ __html: activeAction.preview }}
          />
        </div>
        {activeAction.previewTitle && (
          <div className="tk-slash-preview-title">{activeAction.previewTitle}</div>
        )}
      </div>
    ) : null;

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
      {typeof document !== "undefined" && preview ? createPortal(preview, document.body) : null}
    </>
  );
}

function SlashItem({
  item,
  active,
  iconRenderer,
  onHover,
  onClick,
}: {
  item: InsertAction;
  active: boolean;
  iconRenderer?: (icon: string) => React.ReactNode;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="tk-slash-item"
      data-active={active || undefined}
      data-disabled={item.available ? undefined : true}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <span className="tk-slash-item-icon">{iconRenderer ? iconRenderer(item.icon) : item.icon}</span>
      <span className="tk-slash-item-text">
        <span className="tk-slash-item-label">{item.label}</span>
        <span className="tk-slash-item-desc">{item.description}</span>
      </span>
      {item.shortcut && <span className="tk-slash-item-shortcut">{item.shortcut}</span>}
    </button>
  );
}
