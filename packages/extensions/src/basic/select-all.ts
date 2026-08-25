import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";

/* 通用块级全选：
 * 首次 Mod-a 选中"用户感知的当前整体块"内全部文本；再次 Mod-a 才全选全文。
 *
 * 「整体块」白名单（含多块内容的容器）：
 *   codeBlock / callout / blockquote / detailsContent / column / tableCell / tableHeader
 * 在列表 / 列表项 / 表格行等中间结构里时，继续向上穿透到最近的整体块；
 * 找不到则回退为当前文本块（paragraph/heading 等独立文本块）。
 * 叶子块（imageBlock/hr/katex/iframe/attachment 等无文本内容）与跨块选区直接放行全选全文。 */

const WHOLE_BLOCK_TYPES = new Set([
  "codeBlock",
  "callout",
  "blockquote",
  "detailsContent",
  "column",
  "tableCell",
  "tableHeader",
]);

const TRANSPARENT_TYPES = new Set([
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "table",
  "tableRow",
  "details",
  "detailsSummary",
  "columns",
]);

/** 在以 node 为根、绝对起点为 nodeStartAbs（node open 之后的位置）的子树中，
 *  返回第一个非空 textblock 的文本起始位置 与 最后一个非空 textblock 的文本结束位置。 */
function findTextblockRangeInSubtree(
  node: Node,
  nodeStartAbs: number,
): { from: number; to: number } | null {
  let firstStart = -1;
  let lastEnd = -1;

  // nodeStartAbs 指向 node 内部第一个位置（即 open 之后）
  // 子节点相对 nodeStartAbs 的偏移：第一个子节点在 nodeStartAbs 处
  function walk(n: Node, internalStart: number) {
    if (n.isTextblock) {
      if (n.content.size > 0) {
        // n open 在 internalStart - 1，内容从 internalStart 开始，到 internalStart + n.content.size 结束
        const s = internalStart;
        const e = internalStart + n.content.size;
        if (firstStart < 0 || s < firstStart) firstStart = s;
        if (e > lastEnd) lastEnd = e;
      }
      return;
    }
    // 非 textblock 容器：子节点依次排列在 n 内部
    // 每个子节点 child 占据 1(open) + child.content.size + 1(close) = child.nodeSize
    // 第 i 个子节点在 n 内的 content 偏移 = 前 i 个子节点的 nodeSize 之和
    let childOffset = 0;
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      // child 的 open token 位置 = internalStart + childOffset
      // child 的内部起点（child open 之后）= internalStart + childOffset + 1
      walk(child, internalStart + childOffset + 1);
      childOffset += child.nodeSize;
    }
  }

  walk(node, nodeStartAbs);
  if (firstStart < 0 || lastEnd < 0) return null;
  return { from: firstStart, to: lastEnd };
}

export const SelectAll = Extension.create({
  name: "selectAll",

  addKeyboardShortcuts() {
    const handleSelectAll = () => {
      const { state } = this.editor;
      const { selection } = state;
      const { $from, $to } = selection;

      if (!$from.sameParent($to)) return false;
      if (!$from.parent.isTextblock) return false;

      // 向上找目标块：白名单容器优先，否则当前 textblock
      let targetDepth = -1;
      for (let d = $from.depth; d > 0; d--) {
        const name = $from.node(d).type.name;
        if (WHOLE_BLOCK_TYPES.has(name)) {
          targetDepth = d;
          break;
        }
        if (!TRANSPARENT_TYPES.has(name) && !$from.node(d).isTextblock) {
          break;
        }
      }

      let targetFrom: number;
      let targetTo: number;

      if (targetDepth > 0) {
        const targetNode = $from.node(targetDepth);
        const startAbs = $from.start(targetDepth); // 容器内部起点（=before+1）
        if (targetNode.isTextblock) {
          // codeBlock / blockquote 这类本身是 textblock
          targetFrom = startAbs;
          targetTo = $from.end(targetDepth);
        } else {
          const range = findTextblockRangeInSubtree(targetNode, startAbs);
          if (!range) return false;
          targetFrom = range.from;
          targetTo = range.to;
        }
      } else {
        targetFrom = $from.start($from.depth);
        targetTo = $from.end($from.depth);
      }

      if (targetTo <= targetFrom) return false;

      if (selection.from !== targetFrom || selection.to !== targetTo) {
        this.editor.commands.setTextSelection({ from: targetFrom, to: targetTo });
        return true;
      }
      return false;
    };

    return {
      "Mod-a": handleSelectAll,
    };
  },
});
