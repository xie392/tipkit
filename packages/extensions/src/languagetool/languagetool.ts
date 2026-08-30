import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/* 语法检查扩展（参考 tiptap-languagetool 设计）。
 * headless：只产出匹配项状态与装饰（tk-lt-issue），不渲染任何 UI 面板；
 * 检查函数通过 options.check 注入（遵守依赖注入铁律），缺省实现走
 * LanguageTool 公共 API（https://api.languagetool.org/v2/check），
 * 消费方可替换为自建服务或项目内 API。 */

/** LanguageTool API 返回的单条问题（裁剪常用字段） */
export interface LanguageToolMatch {
  /** 在纯文本中的起始偏移 */
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  ruleId?: string;
  replacements?: { value: string }[];
}

/** 带文档位置的匹配项 */
export interface PositionedLanguageToolMatch extends LanguageToolMatch {
  from: number;
  to: number;
}

export interface LanguageToolState {
  checking: boolean;
  error: string | null;
  matches: PositionedLanguageToolMatch[];
}

export const languageToolKey = new PluginKey<LanguageToolState>("languageTool");
/** 状态更新 meta key（结果分两段写入：开始检查 / 写入结果），导出供消费方/测试注入模拟结果 */
export const languageToolMetaKey = new PluginKey<Partial<LanguageToolState>>("languageToolMeta");

/** 注入的检查函数：接收纯文本与语言，返回匹配项 */
export type LanguageToolChecker = (text: string, language: string) => Promise<LanguageToolMatch[]>;

export interface LanguageToolOptions {
  /** 检查语言，"auto" 交给服务端自动检测 */
  language: string;
  /** 公共 API 地址（仅在未注入 check 时使用） */
  apiBaseUrl: string;
  /** 自定义检查函数（优先于 apiBaseUrl） */
  check?: LanguageToolChecker;
  HTMLAttributes: Record<string, string>;
}

/** 默认实现：LanguageTool 公共 API */
async function defaultCheck(
  text: string,
  language: string,
  apiBaseUrl: string,
): Promise<LanguageToolMatch[]> {
  const res = await fetch(`${apiBaseUrl}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ text, language }).toString(),
  });
  if (!res.ok) throw new Error(`LanguageTool HTTP ${res.status}`);
  const data = (await res.json()) as { matches?: LanguageToolMatch[] };
  return data.matches ?? [];
}

/** 纯文本段：一段 text node 及其在纯文本中的偏移与文档位置 */
export interface TextSegment {
  text: string;
  /** 段落在纯文本中的起始偏移 */
  offset: number;
  /** 段落在文档中的起始 pos（text node 起点） */
  pos: number;
}

/** 收集文档纯文本（块间以 \n\n 分隔）与位置映射 */
export function collectTextSegments(doc: EditorState["doc"]): {
  fullText: string;
  segments: TextSegment[];
} {
  let fullText = "";
  const segments: TextSegment[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segments.push({ text: node.text, offset: fullText.length, pos });
      fullText += node.text;
      return true;
    }
    if (node.isBlock && fullText.length > 0 && !fullText.endsWith("\n\n")) {
      fullText += "\n\n";
    }
    return true;
  });
  return { fullText, segments };
}

/** 把纯文本偏移映射为文档位置（不跨 inline 节点，跨界的匹配被裁剪） */
export function mapMatchToDoc(
  match: LanguageToolMatch,
  segments: TextSegment[],
): PositionedLanguageToolMatch | null {
  const start = match.offset;
  const end = start + match.length;
  const first = segments.find((s) => start >= s.offset && start < s.offset + s.text.length);
  if (!first) return null;
  const last = segments.find((s) => end > s.offset && end <= s.offset + s.text.length);
  if (!last) return null;
  // 匹配范围跨过段间间隙（\n\n / inline 节点）时视为跨界，裁剪掉
  if (last !== first && last.offset !== first.offset + first.text.length) return null;
  const from = first.pos + (start - first.offset);
  const to = last.pos + (end - last.offset);
  if (to <= from) return null;
  return { ...match, from, to };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    languageTool: {
      /** 对全文执行一次语法检查（异步，结果写入插件状态） */
      checkLanguageTool: () => ReturnType;
      /** 应用第 index 条匹配的建议替换（缺省取首个建议） */
      applyLanguageToolSuggestion: (index: number, replacement?: string) => ReturnType;
      /** 忽略第 index 条匹配 */
      dismissLanguageToolMatch: (index: number) => ReturnType;
      /** 清空检查结果 */
      clearLanguageToolMatches: () => ReturnType;
    };
  }
}

export const LanguageTool = Extension.create<LanguageToolOptions>({
  name: "languageTool",

  addOptions() {
    return {
      language: "auto",
      apiBaseUrl: "https://api.languagetool.org/v2",
      check: undefined,
      HTMLAttributes: { class: "tk-lt-issue" },
    };
  },

  addCommands() {
    return {
      checkLanguageTool:
        () =>
        ({ state, dispatch, editor }) => {
          if (dispatch) {
            const { fullText, segments } = collectTextSegments(state.doc);
            dispatch(
              state.tr.setMeta(languageToolMetaKey, { checking: true, error: null }),
            );
            const run =
              this.options.check ??
              ((text: string, language: string) =>
                defaultCheck(text, language, this.options.apiBaseUrl));
            run(fullText, this.options.language)
              .then((matches) => {
                const positioned = matches
                  .map((m) => mapMatchToDoc(m, segments))
                  .filter((m): m is PositionedLanguageToolMatch => m !== null);
                editor.view.dispatch(
                  editor.state.tr.setMeta(languageToolMetaKey, {
                    checking: false,
                    error: null,
                    matches: positioned,
                  }),
                );
              })
              .catch((err: unknown) => {
                editor.view.dispatch(
                  editor.state.tr.setMeta(languageToolMetaKey, {
                    checking: false,
                    error: err instanceof Error ? err.message : String(err),
                    matches: [],
                  }),
                );
              });
          }
          return true;
        },

      applyLanguageToolSuggestion:
        (index: number, replacement?: string) =>
        ({ state, dispatch }) => {
          const s = languageToolKey.getState(state);
          const match = s?.matches[index];
          if (!match) return false;
          const value = replacement ?? match.replacements?.[0]?.value;
          if (value == null) return false;
          if (dispatch) dispatch(state.tr.insertText(value, match.from, match.to));
          return true;
        },

      dismissLanguageToolMatch:
        (index: number) =>
        ({ state, dispatch }) => {
          const s = languageToolKey.getState(state);
          if (!s || index < 0 || index >= s.matches.length) return false;
          if (dispatch) {
            const matches = s.matches.filter((_, i) => i !== index);
            dispatch(state.tr.setMeta(languageToolMetaKey, { ...s, matches }));
          }
          return true;
        },

      clearLanguageToolMatches:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(
              state.tr.setMeta(languageToolMetaKey, {
                checking: false,
                error: null,
                matches: [],
              }),
            );
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const cls = this.options.HTMLAttributes.class ?? "tk-lt-issue";
    return [
      new Plugin<LanguageToolState>({
        key: languageToolKey,
        state: {
          init: () => ({ checking: false, error: null, matches: [] }),
          apply(tr, prev) {
            const meta = tr.getMeta(languageToolMetaKey) as Partial<LanguageToolState> | undefined;
            let next = meta ? { ...prev, ...meta } : prev;
            // 文档变化后旧位置偏移失效，用 mapping 重映射；映射后区间无效则丢弃
            if (next.matches.length && tr.docChanged) {
              next = {
                ...next,
                matches: next.matches
                  .map((m) => ({ ...m, from: tr.mapping.map(m.from), to: tr.mapping.map(m.to, -1) }))
                  .filter((m) => m.to > m.from && m.from < tr.doc.content.size),
              };
            }
            return next;
          },
        },
        props: {
          decorations(state: EditorState) {
            const s = languageToolKey.getState(state);
            if (!s || s.matches.length === 0) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m) =>
                Decoration.inline(m.from, m.to, {
                  class: cls,
                  title: m.shortMessage ?? m.message,
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

export default LanguageTool;
