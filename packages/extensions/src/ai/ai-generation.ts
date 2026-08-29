import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import type { AIProvider } from "@tipkit/core";

/* AI 生成（headless 命令层）：
 * - aiRun({ instruction, mode }) 启动流式生成，内容以 Decoration 高亮预览
 * - aiAccept() 接受（保留文本）/ aiDiscard() 放弃（删除预览内容）
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
  /** 生成中（流未结束） */
  generating: boolean;
  /** 预览内容范围；insert 模式开始前为 null */
  from: number | null;
  to: number | null;
}

const EMPTY_STATE: AiState = { generating: false, from: null, to: null };

export interface AiGenerationOptions {
  /** AI 能力实现（EditorDeps.ai 的同一契约） */
  provider?: AIProvider;
  /** 流式 dispatch 节流间隔 ms */
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
          const replaceMode = mode === "replace" && !selection.empty;
          // 先捕获选区文本（tr 删除后 state 即失效）
          const selectionText = replaceMode
            ? editor.state.doc.textBetween(selection.from, selection.to, "\n")
            : undefined;

          // replace：删除选区文本，生成内容落在同一起点
          const from = replaceMode ? selection.from : selection.to;
          if (replaceMode) tr.delete(selection.from, selection.to);
          tr.setMeta(aiKey, { generating: true, from: null, to: null });
          tr.setMeta("addToHistory", false);

          const controller = new AbortController();
          this.storage.controller = controller;
          this.storage.running = true;

          // 流式写入必须等本次命令的事务派发完成后再启动，否则事务错序
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
              signal: controller.signal,
              insertFrom: replaceMode ? tr.mapping.map(selection.from) : from,
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
          if (dispatch) tr.setMeta(aiKey, EMPTY_STATE);
          return true;
        },

      aiDiscard:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = aiKey.getState(editor.state) as AiState | undefined;
          if (!state || state.from === null) return false;
          if (dispatch) {
            const from = state.from;
            const to = state.to;
            if (to !== null && to > from) tr.delete(from, to);
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
            // 文档被外部编辑时，收缩预览范围可能导致错位——简单处理：保留原范围
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

/** EditorDeps 兜底：React 层通过 storage 注入 provider 时可从 storage.aiProvider 读取 */
function readDepsProvider(editor: Editor): AIProvider | undefined {
  const storage = editor.storage as typeof editor.storage & { aiProvider?: AIProvider };
  return storage.aiProvider;
}

interface RunStreamParams {
  editor: Editor;
  provider: AIProvider;
  instruction: string;
  selectionText?: string;
  signal: AbortSignal;
  insertFrom: number;
  flushInterval: number;
  onDone: () => void;
}

async function runStream(params: RunStreamParams): Promise<void> {
  const { editor, provider, instruction, selectionText, signal, insertFrom, flushInterval, onDone } = params;

  let acc = "";
  let lastFlush = 0;
  let from: number | null = null;
  let to: number | null = null;

  const flush = (final: boolean) => {
    if (from === null) return;
    const start = from;
    const end = to;
    const tr = editor.state.tr;
    if (end !== null && end > start) tr.delete(start, end);
    tr.insertText(acc, start);
    to = start + acc.length;
    tr.setMeta(aiKey, { generating: !final, from: start, to });
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  };

  try {
    for await (const chunk of provider.streamText({ prompt: instruction, selection: selectionText, signal })) {
      if (signal.aborted) break;
      acc += chunk;
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
    flush(true);
  } catch (err) {
    if (!signal.aborted) {
      // 出错时保留已生成内容并结束 generating 状态，由 UI 层提示重试
      flush(true);
      console.error("[tipkit] ai generation failed:", err);
    } else {
      flush(true);
    }
  } finally {
    onDone();
  }
}
