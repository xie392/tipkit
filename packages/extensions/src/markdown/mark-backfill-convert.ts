import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { MarkType } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

/* 回填式行内 mark 转换：
 * 用户习惯：先打 ** / __ / * / _ / ~~，光标移回中间写内容，右移越过闭合符号，最后按空格确认。
 * 闭合符号输入时不会立即转换（可能只是想输入字面量），仅在空格/回车时才生效。
 *
 * 匹配顺序从长到短：** / __ 优先于 * / _，避免 **xxx** 被误判为斜体。
 */

type MarkPattern = {
  name: string;
  // 匹配光标前文本，match[1] 是包裹符号，match[2] 是正文
  regex: RegExp;
  markName: string;
};

const PATTERNS: MarkPattern[] = [
  { name: "bold-star", regex: /(\*\*)([^*]+)\*\*$/, markName: "bold" },
  { name: "bold-under", regex: /(__)([^_]+)__$/, markName: "bold" },
  { name: "strike", regex: /(~~)([^~]+)~~$/, markName: "strike" },
  { name: "italic-star", regex: /(?<!\*)(\*)([^*]+)\*(?!\*)$/, markName: "italic" },
  { name: "italic-under", regex: /(?<!_)(_)([^_]+)_(?!_)$/, markName: "italic" },
];

function tryConvertMark(view: EditorView, insertTrailingSpace: boolean): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;

  const { $cursor } = selection as TextSelection;
  if (!$cursor) return false;

  // 在代码块/行内代码内不处理
  if ($cursor.parent.type.spec.code) return false;

  const textBefore = $cursor.parent.textBetween(0, $cursor.parentOffset, "\n", "\n");
  if (!textBefore) return false;

  for (const pat of PATTERNS) {
    const match = pat.regex.exec(textBefore);
    if (!match) continue;
    const content = match[2];
    if (!content || /^\s+$/.test(content)) continue;

    const markType: MarkType | undefined = state.schema.marks[pat.markName];
    if (!markType) continue;

    // 已在该 mark 内则跳过，避免重复包裹
    if (markType.isInSet($cursor.marks())) continue;

    const blockStart = $cursor.start();
    const from = blockStart + match.index;
    const to = blockStart + $cursor.parentOffset;
    const openLen = match[1].length;
    const closeLen = openLen;
    const textFrom = from + openLen;
    const textTo = to - closeLen;

    const tr = state.tr;
    // 双 delete（右→左）保留原文本节点，再 addMark；顺序不能反，否则左端删除会让右端位置失效
    if (textTo < to) tr.delete(textTo, to);
    if (from < textFrom) tr.delete(from, textFrom);

    const markFrom = from;
    const markTo = markFrom + content.length;
    tr.addMark(markFrom, markTo, markType.create());

    let afterPos = markTo;
    if (insertTrailingSpace) {
      tr.insertText(" ", afterPos);
      tr.removeMark(afterPos, afterPos + 1, markType);
      afterPos += 1;
    }
    tr.setSelection(TextSelection.create(tr.doc, afterPos));
    tr.removeStoredMark(markType);
    view.dispatch(tr.scrollIntoView());
    return true;
  }
  return false;
}

export const MarkBackfillConvert = Extension.create({
  name: "markBackfillConvert",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markBackfillConvert"),
        props: {
          handleKeyDown(view, event) {
            if (event.key === " " || event.code === "Space") {
              return tryConvertMark(view, true);
            }
            if (event.key === "Enter") {
              tryConvertMark(view, false);
              return false;
            }
            return false;
          },
        },
      }),
    ];
  },
});
