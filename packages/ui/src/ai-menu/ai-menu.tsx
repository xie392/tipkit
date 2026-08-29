"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useEditorDeps, useT } from "@tipkit/core";
import { aiKey } from "@tipkit/extensions";

/* AI 助手浮层（受控组件，由消费方渲染触发按钮并管理 open 态）。
 * 仅布局：flex/gap/z-index，视觉归主题 tk-ai-*。
 * 选中文本 → 改写（替换选区）；光标处 → 生成/续写（插入）。
 * 生成中以 Decoration 高亮预览（tk-ai-preview），结束后接受/放弃。 */

type Phase = "input" | "generating" | "review";

export function AiMenu({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const deps = useEditorDeps();
  const [phase, setPhase] = useState<Phase>("input");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const openRef = useRef(open);
  openRef.current = open;

  // 跟随 aiKey 状态：generating → review；复位后关闭
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const st = aiKey.getState(editor.state) as
        | { generating: boolean; from: number | null }
        | undefined;
      if (!st) return;
      if (st.generating) setPhase("generating");
      else if (st.from !== null && (phaseRef.current === "generating" || phaseRef.current === "review")) {
        setPhase("review");
      }
    };
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor]);

  const reset = useCallback(() => {
    setPhase("input");
    setInstruction("");
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  if (!editor) return null;

  const hasSelection = !editor.state.selection.empty;

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
    setPhase("generating");
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tk-ai-menu"
      options={{ placement: "bottom-start", offset: 8 }}
      shouldShow={({ editor: ed }) => ed.isEditable && openRef.current}
      className="tk-ai-menu"
    >
      <div className="tk-ai-panel" data-phase={phase}>
        <span className="tk-ai-title">{t("ai.title")}</span>

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
                  if (e.key === "Escape") reset();
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
              <button
                type="button"
                className="tk-ai-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={reset}
              >
                {t("ai.discard")}
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
          </div>
        )}

        {phase === "review" && (
          <div className="tk-ai-review-row">
            <button
              type="button"
              className="tk-ai-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.commands.aiAccept();
                reset();
              }}
            >
              {t("ai.accept")}
            </button>
            <button
              type="button"
              className="tk-ai-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.commands.aiDiscard();
                reset();
              }}
            >
              {t("ai.discard")}
            </button>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

export default AiMenu;
