import {
  InputRule,
  callOrReturn,
  getMarksBetween,
} from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/* 安全版 markInputRule（迁移自 blog rich-text/safe-mark-input-rule.ts）：
 * Tiptap 3.x 内置 markInputRule 在 delete + addMark 组合时因
 * 位置映射崩溃（"Cannot read properties of undefined (reading 'nodeSize')"），
 * 导致 `ss` / **ss** 等行内 markdown 输入规则失效。
 * 这里改为 delete + insertText + addMark 三步走，每步基于上一步后的
 * 文档位置，避免中间状态映射异常。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tiptap MarkType 包装类型，运行时与官方一致
type AnyMarkType = any;

interface InputRuleMatchResult {
  index: number;
  text: string;
  replaceWith?: string;
  data?: unknown;
}

interface SafeMarkRuleConfig {
  find:
    | RegExp
    | ((text: string) => RegExpMatchArray | InputRuleMatchResult | null);
  type: AnyMarkType;
  getAttributes?:
    | Record<string, unknown>
    | ((match: RegExpMatchArray) => Record<string, unknown> | false | null);
}

export function safeMarkInputRule(config: SafeMarkRuleConfig) {
  return new InputRule({
    find: config.find as never,
    handler: ({ state, range, match }) => {
      const attributes = callOrReturn(config.getAttributes, undefined, match);
      if (attributes === false || attributes === null) return null;

      const tr = state.tr;
      const captureGroup = match[match.length - 1];
      const fullMatch = match[0];
      if (!captureGroup) return null;

      const startSpaces = fullMatch.search(/\S/);
      const deleteFrom = range.from + startSpaces;
      const deleteTo = range.to;

      // 检查冲突 mark（与官方逻辑一致）
      const textStart = range.from + fullMatch.indexOf(captureGroup);
      const excludedMarks = getMarksBetween(range.from, range.to, state.doc)
        .filter((item) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PM MarkType.excluded 运行时存在
          const excluded = (item.mark.type as any).excluded as AnyMarkType[];
          return excluded.find(
            (type: AnyMarkType) => type === config.type && type !== item.mark.type,
          );
        })
        .filter((item) => item.to > textStart);
      if (excludedMarks.length) return null;

      // 删除整个匹配 → 插入纯文本 → 加 mark
      tr.delete(deleteFrom, deleteTo);
      tr.insertText(captureGroup, deleteFrom);
      tr.addMark(
        deleteFrom,
        deleteFrom + captureGroup.length,
        config.type.create(attributes || {}),
      );
      // 将光标移到 mark 结束位置之后，否则后续输入仍在 mark 内。
      const afterPos = deleteFrom + captureGroup.length;
      tr.setSelection(TextSelection.create(tr.doc, afterPos));
      tr.removeStoredMark(config.type);
    },
  });
}
