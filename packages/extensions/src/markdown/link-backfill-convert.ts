import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/* 回填式链接转换（移植自 blog 项目）：
 * 标准 input rule 在 IME 组合输入或某些情况下可能不触发，
 * 导致 [文字](url) 留在纯文本中。
 * 此插件在 compositionend / 空格 / 回车时兜底检测并转换为链接。
 */

// 匹配 [文字](url)，捕获组 1=文字、2=url；不要求 ) 在行尾
const MARKDOWN_LINK = /\[([\w一-龥\s\-_/|]+)\]\((https?:\/\/[^\s)]+)\)/g;

function findAndConvert(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;

  const { $cursor } = selection as TextSelection;
  if (!$cursor) return false;
  if ($cursor.parent.type.spec.code) return false;

  const parentOffset = $cursor.parentOffset;
  const textBefore = $cursor.parent.textBetween(0, parentOffset, "\n", "\n");

  const linkType = state.schema.marks.link;
  if (!linkType) return false;

  let lastMatch: RegExpExecArray | null = null;
  MARKDOWN_LINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKDOWN_LINK.exec(textBefore)) !== null) {
    lastMatch = m;
  }
  if (!lastMatch) return false;

  const label = lastMatch[1];
  const href = lastMatch[2];
  if (!label || !href) return false;

  // 检查该范围是否已有 link mark，避免重复转换
  const blockStart = $cursor.start();
  const from = blockStart + lastMatch.index;
  const to = blockStart + lastMatch.index + lastMatch[0].length;

  if (state.doc.rangeHasMark(from, to, linkType)) return false;

  const tr = state.tr;
  tr.delete(from, to);
  tr.insertText(label, from);
  tr.addMark(from, from + label.length, linkType.create({ href }));
  // 光标恢复到原来的相对位置（删除/插入的长度差）
  const delta = label.length - lastMatch[0].length;
  const newCursor = Math.max(from + label.length, parentOffset + blockStart + delta);
  tr.setSelection(TextSelection.create(tr.doc, newCursor));
  tr.removeStoredMark(linkType);
  tr.setMeta("preventAutolink", true);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export const LinkBackfillConvert = Extension.create({
  name: "linkBackfillConvert",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("linkBackfillConvert"),
        props: {
          handleKeyDown(view, event) {
            if (event.key === " " || event.code === "Space") {
              return findAndConvert(view);
            }
            if (event.key === "Enter") {
              findAndConvert(view);
              return false;
            }
            return false;
          },
          handleDOMEvents: {
            compositionend: (view) => {
              setTimeout(() => findAndConvert(view), 0);
              return false;
            },
          },
        },
      }),
    ];
  },
});
