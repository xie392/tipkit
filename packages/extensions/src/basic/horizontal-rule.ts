import { HorizontalRule } from "@tiptap/extension-horizontal-rule";

/**
 * 定制分隔线：包一层可交互容器（div[data-type="hr-wrap"]）。
 *
 * 默认 <hr> 仅 1-2px 高，悬停/点击命中区域太小，块手柄与块操作菜单
 * （删除/复制等）难以触发。包裹容器提供足够大的 hover/click 区域，
 * 让分隔线和其他块节点一样支持选中与块级操作。
 */
export const CustomHorizontalRule = HorizontalRule.extend({
  selectable: true,

  renderHTML() {
    return ["div", { "data-type": "hr-wrap", class: "tk-hr-wrap" }, ["hr"]];
  },

  parseHTML() {
    return [{ tag: "hr" }, { tag: "div[data-type='hr-wrap']" }];
  },
});
