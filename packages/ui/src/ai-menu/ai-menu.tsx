"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEditorDeps, useT } from "@tipkit/core";
import { aiKey } from "@tipkit/extensions";

/* AI 助手浮层：
 * - 斜杠菜单「AI 助手」或 editor.view.dom 上 "tk-ai:open" 事件打开
 * - 事件可传 detail: { mode?: "insert"|"replace", preset?: string, autoRun?: boolean }
 * - 面板支持标题栏拖拽移动；点击外部不关闭；仅通过 ✕ / 接受 / 放弃 / Esc 关闭
 * - 流式预览时显示生成中的纯文本；流结束进入 review，800ms 后自动接受并把 Markdown 转为富文本节点
 */

type Phase = "input" | "generating" | "review";

interface AnchorRect {
  top: number;
  left: number;
  bottom: number;
}

interface OpenDetail {
  mode?: "insert" | "replace";
  preset?: string;
  autoRun?: boolean;
}

export function AiMenu({ editor }: { editor: Editor | null }) {
  const t = useT();
  const deps = useEditorDeps();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const instructionRef = useRef("");
  instructionRef.current = instruction;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const close = useCallback(() => {
    setOpen(false);
    setPhase("input");
    setInstruction("");
    setError(null);
    setPos(null);
  }, []);

  const closeRef = useRef(close);
  closeRef.current = close;

  const discardAndClose = useCallback(() => {
    if (editor && !editor.isDestroyed) editor.commands.aiDiscard();
    close();
  }, [editor, close]);

  const acceptAndClose = useCallback(() => {
    editor?.commands.aiAccept();
    close();
  }, [editor, close]);

  const runGenerate = useCallback(
    (mode: "insert" | "replace", prompt: string) => {
      if (!editor || editor.isDestroyed) return;
      const ed = editor;
      const curDeps = depsRef.current;
      if (!curDeps.ai) {
        setError(t("ai.needProvider"));
        return;
      }
      const sel = ed.state.selection;
      const canReplace = sel instanceof TextSelection && !sel.empty && mode === "replace";
      const actualMode: "insert" | "replace" = canReplace ? "replace" : "insert";
      const ok = ed
        .chain()
        .focus()
        .aiRun({ instruction: prompt, mode: actualMode, provider: curDeps.ai })
        .run();
      if (!ok) setError(t("ai.emptySelection"));
      else setError(null);
    },
    [editor, t],
  );
  const runGenerateRef = useRef(runGenerate);
  runGenerateRef.current = runGenerate;

  /* 打开事件 */
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail ?? {};
      const sel = editor.state.selection;
      const selHasText = sel instanceof TextSelection && !sel.empty;
      setHasSelection(selHasText);
      const coords = editor.view.coordsAtPos(sel.to);
      setAnchor({ top: coords.top, left: coords.left, bottom: coords.bottom });
      setPos(null);
      setPhase("input");
      setError(null);
      const preset = detail.preset?.trim() ?? "";
      setInstruction(preset);
      setOpen(true);
      if (detail.autoRun && preset) {
        const m: "insert" | "replace" = detail.mode ?? (selHasText ? "replace" : "insert");
        setTimeout(() => runGenerateRef.current(m, preset), 0);
      }
    };
    dom.addEventListener("tk-ai:open", handleOpen);
    return () => dom.removeEventListener("tk-ai:open", handleOpen);
  }, [editor]);

  /* Esc：任何阶段都 = 放弃（恢复原文）+ 关闭 */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      discardAndClose();
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, discardAndClose]);

  /* 标题栏拖拽 */
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const panel = panelRef.current;
      const w = panel?.offsetWidth ?? 360;
      const h = panel?.offsetHeight ?? 200;
      setPos({
        left: Math.max(4, Math.min(window.innerWidth - w - 4, d.startLeft + (e.clientX - d.startX))),
        top: Math.max(4, Math.min(window.innerHeight - h - 4, d.startTop + (e.clientY - d.startY))),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [open]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a")) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, []);

  /* 跟随 aiKey 状态 */
  useEffect(() => {
    if (!editor || !open) return;
    let pending: Phase | null = null;
    const flush = () => {
      if (pending) {
        setPhase(pending);
        pending = null;
      }
    };
    const sync = () => {
      const st = aiKey.getState(editor.state) as { generating: boolean; from: number | null } | undefined;
      if (!st) return;
      if (st.generating) pending = "generating";
      else if (st.from !== null && (phaseRef.current === "generating" || phaseRef.current === "review")) pending = "review";
      else return;
      setTimeout(flush, 0);
    };
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
      pending = null;
    };
  }, [editor, open]);

  useEffect(() => {
    if (open && phase === "input") inputRef.current?.focus();
  }, [open, phase]);

  /* 面板打开时，监听选区变化以更新 hasSelection */
  useEffect(() => {
    if (!open || !editor) return;
    const updateSel = () => {
      const sel = editor.state.selection;
      setHasSelection(sel instanceof TextSelection && !sel.empty);
    };
    editor.on("selectionUpdate", updateSel);
    return () => {
      editor.off("selectionUpdate", updateSel);
    };
  }, [open, editor]);

  if (!editor || !open || !anchor) return null;

  const PANEL_WIDTH = 360;
  const initialLeft = Math.min(Math.max(anchor.left, 8), Math.max(8, window.innerWidth - PANEL_WIDTH - 8));
  const above = anchor.top - 140 - 12;
  const initialTop = above >= 70 ? above : Math.min(anchor.bottom + 8, window.innerHeight - 160);
  const panelLeft = pos?.left ?? initialLeft;
  const panelTop = pos?.top ?? initialTop;

  const PRESETS = hasSelection
    ? [
        { label: t("ai.polish"), prompt: "请对这段文字润色，使其表达更流畅自然，保持原意" },
        { label: t("ai.formal"), prompt: "请将这段文字改写为更正式专业的语气" },
        { label: t("ai.concise"), prompt: "请将这段文字精简，去除冗余表达" },
        { label: t("ai.expand"), prompt: "请扩写这段文字，补充细节与论述" },
      ]
    : [];

  const onSubmit = () => {
    const p = instructionRef.current.trim();
    if (!p) return;
    runGenerate(hasSelection ? "replace" : "insert", p);
  };

  const panel = (
    <div
      ref={panelRef}
      className="tk-ai-panel"
      data-phase={phase}
      style={{ position: "fixed", top: panelTop, left: panelLeft, width: PANEL_WIDTH, zIndex: 10000 }}
    >
      <div className="tk-ai-panel-head" style={{ cursor: "move" }} onMouseDown={onDragStart}>
        <span className="tk-ai-title">{t("ai.title")}</span>
        <button
          type="button"
          className="tk-ai-btn tk-ai-close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => discardAndClose()}
          aria-label={t("ai.cancel")}
          style={{ cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {phase === "input" && (
        <>
          {PRESETS.length > 0 && (
            <div className="tk-ai-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="tk-ai-preset"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setInstruction(p.prompt);
                    runGenerate("replace", p.prompt);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="tk-ai-input-row">
            <input
              ref={inputRef}
              className="tk-ai-input"
              value={instruction}
              placeholder={hasSelection ? t("ai.rewritePlaceholder") : t("ai.placeholder")}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && instruction.trim()) {
                  e.preventDefault();
                  onSubmit();
                }
                if (e.key === "Escape") close();
              }}
            />
            <button
              type="button"
              className="tk-ai-btn"
              disabled={!instruction.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onSubmit}
            >
              {hasSelection ? t("ai.rewrite") : t("ai.generate")}
            </button>
          </div>
          {error ? (
            <span className="tk-ai-error">{error}</span>
          ) : (
            <span className="tk-ai-hint">{hasSelection ? t("ai.rewriteHint") : t("ai.emptySelection")}</span>
          )}
        </>
      )}

      {phase === "generating" && (
        <div className="tk-ai-progress-row">
          <span className="tk-ai-status">{t(hasSelection ? "ai.rewriting" : "ai.generating")}</span>
          <button
            type="button"
            className="tk-ai-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && !editor.isDestroyed && editor.commands.aiCancel()}
          >
            {t("ai.stop")}
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="tk-ai-review-row">
          <button
            type="button"
            className="tk-ai-btn tk-ai-btn-primary"
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
          <span className="tk-ai-hint">{t("ai.autoAcceptHint")}</span>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

export default AiMenu;
