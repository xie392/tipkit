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

/**
 * 无头 SlashMenu：斜杠菜单的交互原语（定位、键盘导航、滚动跟随、预览）。
 *
 * 键盘导航监听 editor.view.dom（而非菜单 DOM）——菜单经 portal 渲染到 body，
 * 键盘事件发生在 ProseMirror 内，只有监听编辑器 DOM 才能收到。
 * 视觉剥离：只带语义类名（tk-slash-*），视觉由主题 CSS 提供。
 */

export interface SlashMenuProps {
  editor: Editor | null;
  onUploadImage?: (file: File) => Promise<string>;
  /** 图标映射：lucide 图标名 → React 节点（消费方提供图标库） */
  iconRenderer?: (icon: string) => React.ReactNode;
}

const INACTIVE: SlashCommandState = {
  active: false,
  query: "",
  from: 0,
  to: 0,
  key: "",
};

const MENU_WIDTH = 256;
const PREVIEW_WIDTH = 232;
const MENU_MAX_HEIGHT = 360;
const OFFSET = 8;

export function SlashMenu({ editor, onUploadImage, iconRenderer }: SlashMenuProps) {
  const [slash, setSlash] = useState<SlashCommandState>(INACTIVE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKey, setHiddenKey] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 供 keydown 监听器读取最新状态（避免闭包过期）
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

    const menuW = (menuRef.current?.offsetWidth || MENU_WIDTH) + PREVIEW_WIDTH;
    const menuH = menuRef.current?.offsetHeight || MENU_MAX_HEIGHT;
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

  /* 状态同步 + 键盘导航（监听编辑器 DOM，捕获阶段） */
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
        if (action && action.available) {
          action.run();
          setHiddenKey(cur.key);
          setPos(null);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        setHiddenKey(cur.key);
        setPos(null);
      }
    };
    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => {
      editor.off("update", syncSlash);
      editor.off("selectionUpdate", syncSlash);
      editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor, hiddenKey, updatePosition]);

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

  /* 键盘导航时滚动列表，让高亮项始终可见 */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIndex] as HTMLElement | undefined;
    if (!item) return;
    const itemTop = item.offsetTop;
    if (itemTop < list.scrollTop) {
      list.scrollTop = itemTop;
    } else if (itemTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemTop + item.offsetHeight - list.clientHeight;
    }
  }, [activeIndex]);

  const isVisible = slash.active && hiddenKey !== slash.key && pos !== null;
  const activeAction = actions[activeIndex];

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

  const menu = isVisible ? (
    <div
      ref={menuRef}
      className="tk-slash-menu"
      style={{
        position: "fixed",
        top: pos?.top,
        left: pos?.left,
        width: MENU_WIDTH + PREVIEW_WIDTH,
        zIndex: 9999,
      }}
      role="menu"
    >
      <div ref={listRef} className="tk-slash-menu-list" style={{ width: MENU_WIDTH }}>
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
      {/* 右侧预览面板：高亮项的预览（HTML 字符串） */}
      <div className="tk-slash-menu-preview" style={{ width: PREVIEW_WIDTH }}>
        {activeAction?.preview ? (
          <div
            className="tk-slash-menu-preview-body"
            dangerouslySetInnerHTML={{ __html: activeAction.preview }}
          />
        ) : (
          <div className="tk-slash-menu-preview-empty">选中命令查看预览</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
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
      <span className="tk-slash-item-label">{item.label}</span>
      <span className="tk-slash-item-desc">{item.description}</span>
      {item.shortcut && <span className="tk-slash-item-shortcut">{item.shortcut}</span>}
    </button>
  );
}
