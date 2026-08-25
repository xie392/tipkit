import { Extension } from "@tiptap/core";

/* 通用块级全选（对齐代码块行为）：
 * 首次 Mod-a 仅选中光标所在的文本块；再次 Mod-a 才全选全文。
 * 叶子块（图片/分隔线等无文本内容）与跨块选区跳过，直接走默认全选。 */

export const SelectAll = Extension.create({
  name: "selectAll",

  addKeyboardShortcuts() {
    const handleSelectAll = () => {
      const { state } = this.editor;
      const { selection } = state;
      const { $from, $to } = selection;

      // 仅当选区落在同一个文本块内时拦截；跨块选区 / 叶子块走默认全选
      const parent = $from.parent;
      if (!parent.isTextblock || !$from.sameParent($to)) {
        return false;
      }

      const blockStart = $from.start($from.depth);
      const blockEnd = $from.end($from.depth);

      // 尚未整块选中 → 选中整块；已整块选中 → 放行给内置 selectAll 全选全文
      if (selection.from !== blockStart || selection.to !== blockEnd) {
        this.editor.commands.setTextSelection({ from: blockStart, to: blockEnd });
        return true;
      }

      return false;
    };

    return {
      "Mod-a": handleSelectAll,
    };
  },
});
