"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  filterInsertActions,
  getInsertActions,
  getSlashCommandState,
  type InsertAction,
  type SlashCommandState,
} from "@tipkit/extensions";
import { createUploadId, finalizeImageUpload, useT } from "@tipkit/core";
import { openLinkDialog } from "../bubble-menu/link-dialog";

export interface SlashMenuProps {
  editor: Editor | null;
  onUploadImage?: (file: File) => Promise<string>;
  iconRenderer?: (icon: string) => React.ReactNode;
  /** 是否展示「AI 助手」入口（消费方需已注册 AiGeneration + AiMenu 并注入 deps.ai） */
  aiEnabled?: boolean;
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

export function SlashMenu({ editor, onUploadImage, iconRenderer, aiEnabled = false }: SlashMenuProps) {
  const t = useT();
  const [slash, setSlash] = useState<SlashCommandState>(INACTIVE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKey, setHiddenKey] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // 预览弹窗的视口 top：每次定位/高亮变化后实时测量高亮项位置，
  // 保证滚动时预览跟随菜单与高亮项（仅在贴近视口底部时贴边）
  const [previewTop, setPreviewTop] = useState<number | null>(null);
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
            openLinkDialog,
            clearSlashQuery: true,
            t,
            aiEnabled,
          })
        : [],
    [editor, onUploadImage, t, aiEnabled],
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
    // 光标贴近视口底部时翻转到 / 字符上方，但始终紧邻 / 字符；
    // 不做视口边缘 clamp —— / 滚出视口时菜单跟着出去（严格跟随）
    if (top + menuH > vh - 12) {
      top = coords.top - menuH - OFFSET;
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
      const next = getSlashCommandState(editor);
      const cur = stateRef.current.slash;
      // 逐字段比较：无变化不 setState，避免编辑器每次事务都重渲染本组件
      if (
        cur.active === next.active &&
        cur.query === next.query &&
        cur.from === next.from &&
        cur.to === next.to &&
        cur.key === next.key
      ) {
        return;
      }
      setSlash(next);
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
    if (!slash.active) {
      setHiddenKey("");
      setPos(null);
      return;
    }
    if (hiddenKey === slash.key) {
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
  }, [activeIndex]);

  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // 输入法组合期（拼音候选确认）的按键不触发命令选择
      if (event.isComposing || event.keyCode === 229) return;
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
        // 阻止同一次 Enter 继续传给后续监听器（如 emoji 浮层），
        // 否则选完命令的同一按键会被 emoji 浮层当作"确认插入"
        event.stopImmediatePropagation();
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

  // 预览弹窗垂直位置：实时测量高亮项的视口位置，滚动时跟随菜单与高亮项
  useLayoutEffect(() => {
    if (!isVisible || !activeAction?.preview) {
      setPreviewTop((prev) => (prev === null ? prev : null));
      return;
    }
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    if (!el) {
      setPreviewTop((prev) => (prev === null ? prev : null));
      return;
    }
    // 严格跟随高亮项
    const top = el.getBoundingClientRect().top - 4;
    setPreviewTop((prev) => (prev === top ? prev : top));
  }, [activeIndex, pos, isVisible, activeAction]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage || !editor) return;
    // 先插入占位节点（本地 blob 预览 + 上传中遮罩），上传结束后替换 src 或移除
    const uploadId = createUploadId();
    const previewUrl = URL.createObjectURL(file);
    editor
      .chain()
      .focus()
      .setImageBlock({ src: previewUrl, uploading: true, uploadId })
      .run();
    onUploadImage(file)
      .then((src) => {
        finalizeImageUpload(editor, uploadId, src || null);
      })
      .catch(() => {
        finalizeImageUpload(editor, uploadId, null);
      })
      .finally(() => {
        URL.revokeObjectURL(previewUrl);
      });
  };

  const execute = (action: InsertAction) => {
    if (!action.available) return;
    action.run();
    setHiddenKey(slash.key);
    setPos(null);
  };

  let previewLeft = 0;
  let showPreview = false;
  if (isVisible && pos && previewTop !== null && activeAction?.preview) {
    const onRight = pos.left + MENU_WIDTH + PREVIEW_GAP + PREVIEW_WIDTH + 16 < window.innerWidth;
    previewLeft = onRight
      ? pos.left + MENU_WIDTH + PREVIEW_GAP
      : pos.left - PREVIEW_WIDTH - PREVIEW_GAP;
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
        zIndex: 65,
      }}
      onMouseDown={(e) => e.preventDefault()}
      role="menu"
    >
      <div ref={listRef} className="tk-slash-menu-list">
        {actions.length === 0 && <div className="tk-slash-menu-empty">{t("slash.noMatch")}</div>}
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
        <span>{t("slash.closeMenu")}</span>
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
          top: previewTop ?? 0,
          left: previewLeft,
          width: PREVIEW_WIDTH,
          zIndex: 64,
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
      <input ref={fileRef} type="file" accept="image/*" className="tk-hidden" onChange={handleFile} />
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
