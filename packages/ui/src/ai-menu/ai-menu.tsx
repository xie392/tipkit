"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEditorDeps, useT } from "@tipkit/core";
import { aiKey } from "@tipkit/extensions";

/* AI 助手浮层（自控开关，由斜杠菜单「AI 助手」或其他触发按钮通过
 * editor.view.dom 上的 "tk-ai:open" 事件打开）。
 * 仅布局：flex/gap/z-index，视觉归主题 tk-ai-*。
 * 面板定位在打开时光标/选区处，不随光标移动（避免生成中点正文把面板带走）。
 * 关闭方式：Esc / 点击面板外部 / 接受或放弃后自动关闭。
 * 生成中点外部 = 中断并放弃，保证任何时刻都能退出。 */

type Phase = "input" | "generating" | "review";

interface AnchorRect {
  top: number;
  left: number;
  bottom: number;
}

export function AiMenu({ editor }: { editor: Editor | null }) {
  const t = useT();
  const deps = useEditorDeps();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => {
    setOpen(false);
    setPhase("input");
    setInstruction("");
    setError(null);
  }, []);

  const discardAndClose = useCallback(() => {
    if (editor && !editor.isDestroyed) {
      // 生成中：中断 + 删除预览；review：删除预览
      editor.commands.aiDiscard();
    }
    close();
  }, [editor, close]);

  const acceptAndClose = useCallback(() => {
    editor?.commands.aiAccept();
    close();
  }, [editor, close]);

  /* 打开事件：定位到当前光标/选区 */
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleOpen = () => {
      const coords = editor.view.coordsAtPos(editor.state.selection.to);
      setAnchor({ top: coords.top, left: coords.left, bottom: coords.bottom });
      setPhase("input");
      setInstruction("");
      setError(null);
      setOpen(true);
    };
    dom.addEventListener("tk-ai:open", handleOpen);
    return () => dom.removeEventListener("tk-ai:open", handleOpen);
  }, [editor]);

  /* Esc 关闭 / 生成中 Esc = 中断并放弃 */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (phaseRef.current === "generating") discardAndClose();
      else close();
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, close, discardAndClose]);

  /* 点击面板外部关闭（生成中 = 中断并放弃，保证可退出） */
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (phaseRef.current === "generating") discardAndClose();
      else close();
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [open, close, discardAndClose]);

  /* 跟随 aiKey 状态：generating → review。
   * 注意必须延迟（宏任务）切换：点击「生成」的回调里同步替换按钮行时，
   * React 会把同一次点击重放到新渲染出的按钮上（如「放弃」），导致误丢弃。 */
  useEffect(() => {
    if (!editor || !open) return;
    let pending: Phase | null = null;
    const flushPending = () => {
      if (pending) {
        setPhase(pending);
        pending = null;
      }
    };
    const sync = () => {
      const st = aiKey.getState(editor.state) as
        | { generating: boolean; from: number | null }
        | undefined;
      if (!st) return;
      if (st.generating) pending = "generating";
      else if (st.from !== null && (phaseRef.current === "generating" || phaseRef.current === "review")) {
        pending = "review";
      } else {
        return;
      }
      setTimeout(flushPending, 0);
    };
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
      pending = null;
    };
  }, [editor, open]);

  /* 打开时聚焦输入框 */
  useEffect(() => {
    if (open && phase === "input") inputRef.current?.focus();
  }, [open, phase]);

  if (!editor || !open || !anchor) return null;

  // 仅文本选区可改写：NodeSelection（空段落）按无选区处理
  const selection = editor.state.selection;
  const hasSelection = selection instanceof TextSelection && !selection.empty;

  const start = (mode: "insert" | "replace", prompt: string) => {
    if (!deps.ai) {
      setError(t("ai.needProvider"));
      return;
    }
    const ok = editor
      .chain()
      .focus()
      .aiRun({ instruction: prompt, mode, provider: deps.ai })
      .run();
    if (!ok) {
      setError(t("ai.emptySelection"));
      return;
    }
    setError(null);
    // 不在这里 setPhase("generating")：点击回调内同步替换按钮行，
    // React 会把同一次点击重放给新渲染出的「放弃」按钮导致误丢弃。
    // 生成状态由下方监听 aiKey 的 sync 效果（首个 flush 事务）驱动切换。
  };

  const PANEL_WIDTH = 340;
  const left = Math.min(
    Math.max(anchor.left, 8),
    Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 1200) - PANEL_WIDTH - 8),
  );

  const panel = (
    <div
      ref={panelRef}
      className="tk-ai-panel"
      data-phase={phase}
      style={{
        position: "fixed",
        top: Math.min(anchor.bottom + 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 160),
        left,
        width: PANEL_WIDTH,
        zIndex: 10000,
      }}
    >
      <div className="tk-ai-panel-head">
        <span className="tk-ai-title">{t("ai.title")}</span>
        {phase !== "input" && (
          <button
            type="button"
            className="tk-ai-btn tk-ai-close"
            onMouseDown={(e) => e.preventDefault()}
            // 用 phaseRef 而非闭包 phase，避免阶段切换瞬间的过期状态误判
            onClick={() => (phaseRef.current === "generating" ? discardAndClose() : close())}
            aria-label={t("ai.cancel")}
          >
            ✕
          </button>
        )}
      </div>

      {phase === "input" && (
        <>
          <div className="tk-ai-input-row">
            <input
              ref={inputRef}
              className="tk-ai-input"
              value={instruction}
              placeholder={t("ai.placeholder")}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && instruction.trim()) {
                  e.preventDefault();
                  start(hasSelection ? "replace" : "insert", instruction.trim());
                }
                if (e.key === "Escape") close();
              }}
            />
            <button
              type="button"
              className="tk-ai-btn"
              disabled={!instruction.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => start(hasSelection ? "replace" : "insert", instruction.trim())}
            >
              {hasSelection ? t("ai.rewrite") : t("ai.generate")}
            </button>
          </div>
          {error ? (
            <span className="tk-ai-error">{error}</span>
          ) : (
            <span className="tk-ai-hint">{t("ai.emptySelection")}</span>
          )}
        </>
      )}

      {phase === "generating" && (
        <div className="tk-ai-progress-row">
          <span className="tk-ai-status">{t("ai.generating")}</span>
          <button
            type="button"
            className="tk-ai-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.commands.aiCancel()}
          >
            {t("ai.cancel")}
          </button>
          <button
            type="button"
            className="tk-ai-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => discardAndClose()}
          >
            {t("ai.discard")}
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="tk-ai-review-row">
          <button
            type="button"
            className="tk-ai-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={acceptAndClose}
          >
            {t("ai.accept")}
          </button>
          <button
            type="button"
            className="tk-ai-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={discardAndClose}
          >
            {t("ai.discard")}
          </button>
          <span className="tk-ai-hint">Esc = {t("ai.discard")}</span>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

export default AiMenu;
