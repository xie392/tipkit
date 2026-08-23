import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/* 回填式行内代码转换（移植自 blog 项目）：
 * 用户习惯：先打 `，光标移回中间写内容，右移越过闭合反引号，最后按空格确认。
 * 越过闭合反引号时不立即转换（用户可能真想输入字面量 `xx`），
 * 仅在空格/回车确认时才转换，与正常 markdown 输入习惯一致。
 */

const CODE_PATTERN = /`([^`]+)`$/;

function tryConvertCode(view: EditorView, insertTrailingSpace: boolean): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;

  const { $cursor } = selection as TextSelection;
  if (!$cursor) return false;

  // 在代码块节点内不处理
  if ($cursor.parent.type.spec.code) return false;

  const textBefore = $cursor.parent.textBetween(0, $cursor.parentOffset, "\n", "\n");
  const match = CODE_PATTERN.exec(textBefore);
  if (!match) return false;

  const content = match[1];
  if (!content) return false;

  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const blockStart = $cursor.start();
  const from = blockStart + match.index;
  const to = blockStart + $cursor.parentOffset;

  const tr = state.tr;
  tr.delete(from, to);
  tr.insertText(content, from);
  tr.addMark(from, from + content.length, codeType.create());
  let afterPos = from + content.length;
  if (insertTrailingSpace) {
    tr.insertText(" ", afterPos);
    // 空格不能带 code mark，否则后续文字会被困在 code 内
    tr.removeMark(afterPos, afterPos + 1, codeType);
    afterPos += 1;
  }
  tr.setSelection(TextSelection.create(tr.doc, afterPos));
  tr.removeStoredMark(codeType);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export const CodeBackfillConvert = Extension.create({
  name: "codeBackfillConvert",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("codeBackfillConvert"),
        props: {
          handleKeyDown(view, event) {
            if (event.key === " " || event.code === "Space") {
              return tryConvertCode(view, true);
            }
            if (event.key === "Enter") {
              // 转换后不阻止默认换行：先转换，再让 ProseMirror 正常创建新段落
              tryConvertCode(view, false);
              return false;
            }
            return false;
          },
        },
      }),
    ];
  },
});
