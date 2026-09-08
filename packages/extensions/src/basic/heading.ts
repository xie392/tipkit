import Heading from "@tiptap/extension-heading";
import { textblockTypeInputRule } from "@tiptap/core";

/**
 * 自定义 Heading 扩展（基于 @tiptap/extension-heading extend）。
 *
 * 目的：替换 StarterKit 内置 Heading 的 input rule 注册时机。
 * 原版 heading input rules 在 StarterKit 初始插件批次注册；本扩展放在
 * 所有基础扩展之后注册，让其 input rule 插件最晚处理 handleTextInput，
 * 作为最终兜底：段尾回车后新空段上输入 `## / ### ` 时，即使前面的 rule
 * 因 $from 位置错位（TrailingNode appendTransaction 后首帧）漏匹配，
 * 这里的规则仍能稳定触发转标题。
 */
export const CustomHeading = Heading.extend({
  addInputRules() {
    const levels = this.options.levels as number[];
    const minLevel = Math.min(...levels);
    return levels.map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${minLevel},${level}})\\s$`),
        type: this.type,
        getAttributes: { level },
      }),
    );
  },
});
