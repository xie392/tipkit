import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/* 失焦保留选区视觉（迁移自 blog rich-text/ext/selection.ts）。
 * 只添加语义类名 tk-selection-blur，视觉由主题 CSS 决定。 */

export const Selection = Extension.create({
  name: "selection",

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey("selection"),
        props: {
          decorations(state) {
            if (state.selection.empty) return null;
            if (editor.isFocused) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(state.selection.from, state.selection.to, {
                class: "tk-selection-blur",
              }),
            ]);
          },
        },
      }),
    ];
  },
});
