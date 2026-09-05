import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import type { InsertAction, SlashCommandState } from "./types";

/* 斜杠菜单状态检测与过滤（迁移自 blog rich-text/insert-actions.tsx）。 */

const INACTIVE_SLASH_COMMAND: SlashCommandState = {
  active: false,
  query: "",
  from: 0,
  to: 0,
  key: "",
};

/** 检测光标前是否为 "/关键词"（段落内生效，支持 blockquote / callout / listItem / column / details 等嵌套容器内的段落） */
export function getSlashCommandState(editor: Editor): SlashCommandState {
  const { state } = editor;
  const { $anchor, empty } = state.selection;

  if (!empty) return INACTIVE_SLASH_COMMAND;

  const node = $anchor.parent;
  if (node.type.name !== "paragraph") return INACTIVE_SLASH_COMMAND;

  const textBeforeCursor = node.textBetween(0, $anchor.parentOffset, "\n", "\n");
  if (!textBeforeCursor.startsWith("/")) return INACTIVE_SLASH_COMMAND;

  const query = textBeforeCursor.slice(1);
  const from = $anchor.start();
  const to = from + textBeforeCursor.length;

  return { active: true, query, from, to, key: `${from}:${to}:${query}` };
}

/** 执行动作前删除 "/关键词" 文本（slash 菜单用）。
 *  删除后若当前段落为空，将选区设为 NodeSelection 选中该空段落，
 *  这样后续 insertContent 会替换整块而非在空段落后追加，避免多一行。 */
export function replaceSlashWithEmpty(editor: Editor) {
  const slash = getSlashCommandState(editor);
  if (!slash.active) return;
  const { state, view } = editor;
  const tr = state.tr.deleteRange(slash.from, slash.to);
  const $from = tr.doc.resolve(slash.from);
  if ($from.parent.type.name === "paragraph" && $from.parent.content.size === 0) {
    const nodePos = $from.before($from.depth);
    if (nodePos >= 0) {
      tr.setSelection(NodeSelection.create(tr.doc, nodePos));
    }
  }
  view.dispatch(tr.scrollIntoView());
}

export function filterInsertActions(actions: InsertAction[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return actions;
  const isSingleCjkQuery = normalizedQuery.length === 1 && /[一-鿿]/.test(normalizedQuery);

  return actions.filter((action) => {
    const label = action.label.toLowerCase();
    const aliases = action.aliases ?? [];

    if (isSingleCjkQuery) {
      return (
        label.startsWith(normalizedQuery) ||
        aliases.some((alias) => alias.toLowerCase() === normalizedQuery)
      );
    }

    const haystack = [label, action.description, action.id, ...aliases]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
