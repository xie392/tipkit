import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
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
          // 仅文本选区可替换：NodeSelection（如斜杠菜单选中的空段落）empty 为 false
          // 但没有可替换内容，走 replace 会删掉空节点并在块边界插入导致错乱
          const hasContent = selection instanceof TextSelection && !selection.empty;
          const replaceMode = mode === "replace" && hasContent;
          // 先捕获选区文本（tr 删除后 state 即失效）
          const selectionText = replaceMode
            ? editor.state.doc.textBetween(selection.from, selection.to, "\n")
            : undefined;

          // replace：删除选区文本，生成内容落在同一起点。
          // 注意 selection.to 可能是块边界（如 NodeSelection 选中空段落），直接 insertText
          // 会在边界上创建独立段落。必须规范到文本块内部：
          // bias=-1 向前找——NodeSelection 选中空段落时 to 在段落之后，
          // 向前 bias 才能落进该空段落本身，而不是跳到下一个节点（否则会并进下方的标题）。
          const $to = tr.doc.resolve(selection.to);
          const safe =
            $to.parent.isTextblock && $to.pos < $to.end()
              ? TextSelection.create(tr.doc, $to.pos)
              : TextSelection.near($to, -1);
          if (!replaceMode && safe.from !== selection.to) {
            tr.setSelection(TextSelection.create(tr.doc, safe.from));
          }
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
          if (dispatch) tr.setMeta(aiKey, EMPTY_STATE);
          return true;
        },

      aiDiscard:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = aiKey.getState(editor.state) as AiState | undefined;
          if (!state || state.from === null) return false;
          // 丢弃时同时中断未完成的流
          this.storage.controller?.abort();
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
    const schema = editor.state.schema;
    const tr = editor.state.tr;
    if (end !== null && end > start) tr.delete(start, end);
    // 用精确的 replaceWith 而非 insertText：后者在空段落/块边界处会触发
    // replaceRange 的"贴合"行为（吞并相邻空段落），导致后续 flush 位置漂移
    tr.replaceWith(start, start, schema.text(acc));
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
    // 中断时：若用户已放弃（预览状态被清空），不再把内容写回；仅取消则保留内容等待接受/放弃
    const st = aiKey.getState(editor.state) as AiState | undefined;
    if (!signal.aborted || st?.generating) flush(true);
  } catch (err) {
    // 出错/中断时保留已生成内容并结束 generating 状态，由 UI 层提示重试
    const st = aiKey.getState(editor.state) as AiState | undefined;
    if (!signal.aborted || st?.generating) flush(true);
    if (!signal.aborted) console.error("[tipkit] ai generation failed:", err);
  } finally {
    onDone();
  }
}
