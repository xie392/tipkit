import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import type { AIProvider } from "@tipkit/core";

/* AI 生成（headless 命令层）：
 * - aiRun({ instruction, mode }) 启动流式生成，内容以 Decoration 高亮预览
 * - aiAccept() 接受（保留文本，含 Markdown 自动解析为富文本）
 * - aiDiscard() 放弃（删除预览；replace 模式下恢复被替换的原文）
 * - aiCancel() 中断流（内容保留，等待接受/放弃）
 * 流式写入用节流 dispatch（~80ms），避免每个 token 一次事务。
 * provider 通过 configure({ provider }) 注入；UI 浮层见 @tipkit/ui 的 AiMenu。 */

export const aiKey = new PluginKey("aiGeneration");

export type AiMode = "insert" | "replace";

export interface AiRunOptions {
  instruction: string;
  /** insert：在光标处插入；replace：替换当前选区。默认 insert */
  mode?: AiMode;
  /** 自定义 provider，缺省用 configure 注入的 */
  provider?: AIProvider;
}

interface AiState {
  generating: boolean;
  from: number | null;
  to: number | null;
  /** replace 模式：被删掉的原文（用于 aiDiscard 时恢复） */
  replacedText: string | null;
  replacedFrom: number | null;
}

const EMPTY_STATE: AiState = { generating: false, from: null, to: null, replacedText: null, replacedFrom: null };

export interface AiGenerationOptions {
  provider?: AIProvider;
  flushInterval?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiGeneration: {
      aiRun: (options: AiRunOptions) => ReturnType;
      aiAccept: () => ReturnType;
      aiDiscard: () => ReturnType;
      aiCancel: () => ReturnType;
    };
  }
}

export const AiGeneration = Extension.create<AiGenerationOptions>({
  name: "aiGeneration",

  addOptions() {
    return {
      provider: undefined,
      flushInterval: 80,
    };
  },

  addStorage() {
    return {
      controller: null as AbortController | null,
      running: false,
    };
  },

  addCommands() {
    return {
      aiRun:
        (options) =>
        ({ editor, tr, dispatch }) => {
          const provider = options.provider ?? this.options.provider ?? readDepsProvider(editor);
          if (!provider) return false;
          if (this.storage.running) return false;
          if (!dispatch) return false;

          const mode: AiMode = options.mode ?? "insert";
          const { selection } = editor.state;
          const hasContent = selection instanceof TextSelection && !selection.empty;
          const replaceMode = mode === "replace" && hasContent;
          const selectionText = replaceMode
            ? editor.state.doc.textBetween(selection.from, selection.to, "\n")
            : undefined;

          const $to = tr.doc.resolve(selection.to);
          const safe =
            $to.parent.isTextblock && $to.pos < $to.end()
              ? TextSelection.create(tr.doc, $to.pos)
              : TextSelection.near($to, -1);
          if (!replaceMode && safe.from !== selection.to) {
            tr.setSelection(TextSelection.create(tr.doc, safe.from));
          }

          let replacedFrom: number | null = null;
          if (replaceMode) {
            replacedFrom = selection.from;
            tr.delete(selection.from, selection.to);
          }
          tr.setMeta(aiKey, {
            generating: true,
            from: null,
            to: null,
            replacedText: replaceMode ? selectionText ?? null : null,
            replacedFrom,
          } as AiState);
          tr.setMeta("addToHistory", false);

          const controller = new AbortController();
          this.storage.controller = controller;
          this.storage.running = true;

          const flushInterval = this.options.flushInterval ?? 80;
          const onDone = () => {
            this.storage.running = false;
            this.storage.controller = null;
          };
          setTimeout(() => {
            void runStream({
              editor,
              provider,
              instruction: options.instruction,
              selectionText,
              controller,
              insertFrom: replaceMode ? tr.mapping.map(selection.from) : safe.from,
              flushInterval,
              onDone,
            });
          }, 0);
          return true;
        },

      aiAccept:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = aiKey.getState(editor.state) as AiState | undefined;
          if (!state || (!state.generating && state.from === null)) return false;
          if (!dispatch) return true;
          const from = state.from;
          const to = state.to;
          // 接受：清除 AI 状态（不再高亮预览）
          tr.setMeta(aiKey, { ...EMPTY_STATE }).setMeta("addToHistory", true);
          // 若预览内容含 Markdown 语法，下一帧异步替换为富文本节点（等本事务派发后再执行，避免事务错序）
          if (from !== null && to !== null && to > from) {
            const text = editor.state.doc.textBetween(from, to, "\n");
            if (looksLikeMarkdown(text)) {
              const startPos = from;
              const endPos = to;
              setTimeout(() => {
                if (editor.isDestroyed) return;
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: startPos, to: endPos })
                  .insertContentAt(startPos, text, { contentType: "markdown" })
                  .run();
              }, 0);
            }
          }
          return true;
        },

      aiDiscard:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = aiKey.getState(editor.state) as AiState | undefined;
          if (!state) return false;
          // 中断未完成的流
          this.storage.controller?.abort();
          if (dispatch) {
            const from = state.from;
            const to = state.to;
            // 1. 删除已生成的预览内容
            if (from !== null && to !== null && to > from) tr.delete(from, to);
            // 2. replace 模式：把原文插回（位置已被 delete 映射，用 mapping 后再插）
            if (state.replacedText && state.replacedFrom !== null) {
              const mappedFrom = tr.mapping.map(state.replacedFrom);
              tr.insertText(state.replacedText, mappedFrom);
            }
            tr.setMeta(aiKey, EMPTY_STATE);
          }
          return true;
        },

      aiCancel:
        () =>
        () => {
          if (!this.storage.running) return false;
          this.storage.controller?.abort();
          // abort 后 runStream 收尾会把 generating 置 false（内容保留待接受/放弃）
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AiState>({
        key: aiKey,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, prev) {
            const meta = tr.getMeta(aiKey);
            if (meta) return meta as AiState;
            // 普通编辑（用户输入/其他命令）时，映射预览范围，避免错位
            if (prev.from !== null && prev.to !== null) {
              const from = tr.mapping.map(prev.from);
              const to = tr.mapping.map(prev.to);
              const replacedFrom = prev.replacedFrom !== null ? tr.mapping.map(prev.replacedFrom) : null;
              if (from !== prev.from || to !== prev.to || replacedFrom !== prev.replacedFrom) {
                return { ...prev, from, to, replacedFrom };
              }
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            const s = aiKey.getState(state) as AiState | undefined;
            if (!s || s.from === null || s.to === null || s.to <= s.from) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(s.from, s.to, { class: "tk-ai-preview" }),
            ]);
          },
        },
      }),
    ];
  },
});

function readDepsProvider(editor: Editor): AIProvider | undefined {
  const storage = editor.storage as typeof editor.storage & { aiProvider?: AIProvider };
  return storage.aiProvider;
}

interface RunStreamParams {
  editor: Editor;
  provider: AIProvider;
  instruction: string;
  selectionText?: string;
  controller: AbortController;
  insertFrom: number;
  flushInterval: number;
  onDone: () => void;
}

function looksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~)/.test(text) ||
    /\*\*[^*\n]+\*\*|__[^_\n]+__/.test(text) ||
    /(^|[^*])\*[^\s*][^*\n]*\*(?!\*)/.test(text) ||
    /~~[^~\n]+~~/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /\[[^\]]+\]\([^)\s]+\)/.test(text) ||
    /(^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(\n|$)/.test(text)
  );
}

async function runStream(params: RunStreamParams): Promise<void> {
  const { editor, provider, instruction, selectionText, controller, insertFrom, flushInterval, onDone } = params;
  const signal = controller.signal;

  let acc = "";
  let lastFlush = 0;
  let from: number | null = null;
  let to: number | null = null;
  /** 静默超时兜底：30s 无新 chunk 则 abort（防止上游连接不关闭导致永久 generating） */
  const SILENCE_TIMEOUT = 30000;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const resetSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }, SILENCE_TIMEOUT);
  };

  const flush = (final: boolean) => {
    if (from === null) return;
    const start = from;
    const end = to;
    const schema = editor.state.schema;
    // 保留 replace 模式下记录的原文，直到 accept/discard 显式清空
    const cur = aiKey.getState(editor.state) as AiState | undefined;
    const tr = editor.state.tr;
    if (end !== null && end > start) tr.delete(start, end);
    tr.replaceWith(start, start, schema.text(acc));
    to = start + acc.length;
    tr.setMeta(aiKey, {
      generating: !final,
      from: start,
      to,
      replacedText: cur?.replacedText ?? null,
      replacedFrom: cur?.replacedFrom ?? null,
    } as AiState);
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  };

  try {
    resetSilence();
    for await (const chunk of provider.streamText({ prompt: instruction, selection: selectionText, signal })) {
      if (signal.aborted) break;
      acc += chunk;
      resetSilence();
      const now = Date.now();
      if (from === null) {
        from = insertFrom;
        to = insertFrom;
      }
      if (now - lastFlush >= flushInterval) {
        lastFlush = now;
        flush(false);
      }
    }
    if (silenceTimer) clearTimeout(silenceTimer);
    // 流结束：最终 flush
    if (from !== null) flush(true);
  } catch (err) {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (from !== null) {
      // 出错或被 abort：把已累积内容 flush 进去，标记生成结束，让用户决定接受/放弃
      flush(true);
    }
    if (!signal.aborted) console.error("[tipkit] ai generation failed:", err);
  } finally {
    if (silenceTimer) clearTimeout(silenceTimer);
    onDone();
  }
}
