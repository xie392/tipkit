import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Selection } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/* 查找替换扩展（参考 tiptap-search-and-replace 设计）。
 * 纯逻辑：ProseMirror 插件维护匹配项与装饰（tk-search-match / is-active），
 * 视觉归主题层。匹配不跨 inline 节点边界（与主流实现一致）。 */

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchAndReplaceState {
  term: string;
  caseSensitive: boolean;
  matches: SearchMatch[];
  activeIndex: number;
}

export const searchAndReplaceKey = new PluginKey<SearchAndReplaceState>("searchAndReplace");

export interface SearchAndReplaceOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      /** 设置搜索词并高亮匹配项 */
      setSearchTerm: (term: string, options?: { caseSensitive?: boolean }) => ReturnType;
      /** 清空搜索状态与高亮 */
      clearSearch: () => ReturnType;
      /** 跳到下一个匹配项 */
      nextSearchMatch: () => ReturnType;
      /** 跳到上一个匹配项 */
      previousSearchMatch: () => ReturnType;
      /** 替换当前激活的匹配项 */
      replaceSearchMatch: (replacement: string) => ReturnType;
      /** 替换全部匹配项，返回替换数量 */
      replaceAllSearchMatches: (replacement: string) => ReturnType;
    };
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 在文本段（text node 级别）中查找全部匹配项 */
function findMatches(
  doc: EditorState["doc"],
  term: string,
  caseSensitive: boolean,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  if (!term) return matches;
  const regex = new RegExp(escapeRegExp(term), caseSensitive ? "g" : "gi");
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(node.text)) !== null) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (m[0].length === 0) regex.lastIndex += 1;
    }
    return true;
  });
  return matches;
}

function buildDecorations(
  state: SearchAndReplaceState,
  doc: EditorState["doc"],
  activeClass: string,
): DecorationSet {
  if (!state.term || state.matches.length === 0) return DecorationSet.empty;
  const decorations = state.matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === state.activeIndex ? `${activeClass} is-active` : activeClass,
    }),
  );
  return DecorationSet.create(doc, decorations);
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions>({
  name: "searchAndReplace",

  addOptions() {
    return { HTMLAttributes: { class: "tk-search-match" } };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string, options?: { caseSensitive?: boolean }) =>
        ({ state, dispatch }) => {
          const prev = searchAndReplaceKey.getState(state);
          const caseSensitive = options?.caseSensitive ?? prev?.caseSensitive ?? false;
          const matches = findMatches(state.doc, term, caseSensitive);
          if (dispatch) {
            const tr = state.tr.setMeta(searchAndReplaceKey, {
              term,
              caseSensitive,
              matches,
              activeIndex: matches.length ? 0 : -1,
            } satisfies SearchAndReplaceState);
            dispatch(tr);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(
              state.tr.setMeta(searchAndReplaceKey, {
                term: "",
                caseSensitive: false,
                matches: [],
                activeIndex: -1,
              } satisfies SearchAndReplaceState),
            );
          }
          return true;
        },

      nextSearchMatch:
        () =>
        ({ state, dispatch }) => {
          const s = searchAndReplaceKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const activeIndex = (s.activeIndex + 1) % s.matches.length;
          if (dispatch) {
            dispatch(
              state.tr
                .setMeta(searchAndReplaceKey, { ...s, activeIndex })
                .setSelection(selectMatch(state.selection, s.matches[activeIndex]))
                .scrollIntoView(),
            );
          }
          return true;
        },

      previousSearchMatch:
        () =>
        ({ state, dispatch }) => {
          const s = searchAndReplaceKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const activeIndex = (s.activeIndex - 1 + s.matches.length) % s.matches.length;
          if (dispatch) {
            dispatch(
              state.tr
                .setMeta(searchAndReplaceKey, { ...s, activeIndex })
                .setSelection(selectMatch(state.selection, s.matches[activeIndex]))
                .scrollIntoView(),
            );
          }
          return true;
        },

      replaceSearchMatch:
        (replacement: string) =>
        ({ state, dispatch }) => {
          const s = searchAndReplaceKey.getState(state);
          if (!s || s.activeIndex < 0 || s.activeIndex >= s.matches.length) return false;
          const match = s.matches[s.activeIndex];
          if (dispatch) {
            const tr = state.tr.insertText(replacement, match.from, match.to);
            dispatch(tr);
          }
          return true;
        },

      replaceAllSearchMatches:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const s = searchAndReplaceKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const matches = findMatches(tr.doc, s.term, s.caseSensitive);
          if (matches.length === 0) return false;
          if (dispatch) {
            // 从后往前替换，避免位置偏移
            for (let i = matches.length - 1; i >= 0; i -= 1) {
              tr.insertText(replacement, matches[i].from, matches[i].to);
            }
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const activeClass = this.options.HTMLAttributes.class ?? "tk-search-match";
    return [
      new Plugin<SearchAndReplaceState>({
        key: searchAndReplaceKey,
        state: {
          init: () => ({ term: "", caseSensitive: false, matches: [], activeIndex: -1 }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchAndReplaceKey) as SearchAndReplaceState | undefined;
            // 文档变化时基于现有词条重算匹配（保持搜索态）
            if (!meta && prev.term && tr.docChanged) {
              const matches = findMatches(tr.doc, prev.term, prev.caseSensitive);
              return { ...prev, matches, activeIndex: matches.length ? Math.min(prev.activeIndex, matches.length - 1) : -1 };
            }
            return meta ?? prev;
          },
        },
        props: {
          decorations(state: EditorState) {
            const s = searchAndReplaceKey.getState(state);
            if (!s || !s.term) return DecorationSet.empty;
            return buildDecorations(s, state.doc, activeClass);
          },
        },
      }),
    ];
  },
});

function selectMatch(current: Selection, match: SearchMatch): Selection {
  return TextSelection.create(current.$anchor.doc, match.from, match.to);
}

export default SearchAndReplace;
