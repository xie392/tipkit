import { Extension, InputRule } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

/* 列表输入规则增强（迁移自 blog rich-text/ext/list-input-rules.ts）。
 * 补充 StarterKit 内置列表输入规则：在已有列表项内输入 `- `、`* `、`+ `
 * 或 `1. ` 时切换列表类型（有序↔无序）。 */

const bulletListInputRegex = /^\s*([-+*])\s$/;
const orderedListInputRegex = /^(\d+)\.\s$/;

function findListContext($from: ResolvedPos): { listType: string } | null {
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "listItem") {
      const list = d > 0 ? $from.node(d - 1) : null;
      if (list && (list.type.name === "bulletList" || list.type.name === "orderedList")) {
        return { listType: list.type.name };
      }
      return null;
    }
  }
  return null;
}

export const ListInputRules = Extension.create({
  name: "listInputRules",

  addInputRules() {
    return [
      new InputRule({
        find: bulletListInputRegex,
        handler: ({ state, range, chain }) => {
          const ctx = findListContext(state.selection.$from);
          if (!ctx || ctx.listType === "bulletList") return null;
          chain().deleteRange(range).toggleList("bulletList", "listItem").run();
        },
      }),
      new InputRule({
        find: orderedListInputRegex,
        handler: ({ state, range, match, chain }) => {
          const ctx = findListContext(state.selection.$from);
          if (!ctx || ctx.listType === "orderedList") return null;
          chain()
            .deleteRange(range)
            .toggleList("orderedList", "listItem", false, { start: +match[1] })
            .run();
        },
      }),
    ];
  },
});
