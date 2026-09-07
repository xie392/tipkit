import {
  InputRule,
  callOrReturn,
  getMarksBetween,
} from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/* 安全版 markInputRule：对齐 Tiptap 官方 markInputRule 的双 delete 策略
 *（先删闭合标记、再删开头标记，保留用户输入的 captureGroup 文本），
 * 避免早期版本「delete 整段 + insertText 重插」导致 addMark 在新插入文本上
 * 不生效（表现为 **xx** 输入完星号消失、但文本未加粗）的问题。
 * 同时：
 *  - 通过 tr.setSelection 将光标显式移到 mark 之后，避免后续输入继续留在 mark 内
 *  - tr.removeStoredMark(type) 清除光标处 storedMark，防止新输入继续加粗
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

      const { tr } = state;
      const captureGroup = match[match.length - 1];
      const fullMatch = match[0];
      if (!captureGroup) return null;

      const startSpaces = fullMatch.search(/\S/);
      const textStart = range.from + fullMatch.indexOf(captureGroup);
      const textEnd = textStart + captureGroup.length;

      // 检查冲突 mark（与官方逻辑一致）
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

      // 对齐官方：先删闭合标记、再删开头标记（顺序重要：先删右端不会影响左端位置映射）
      if (textEnd < range.to) tr.delete(textEnd, range.to);
      if (textStart > range.from) tr.delete(range.from + startSpaces, textStart);

      const markFrom = range.from + startSpaces;
      const markTo = markFrom + captureGroup.length;
      tr.addMark(markFrom, markTo, config.type.create(attributes || {}));

      // 将光标移到 mark 结束位置之后，否则后续输入仍在 mark 内
      tr.setSelection(TextSelection.create(tr.doc, markTo));
      tr.removeStoredMark(config.type);
    },
  });
}
