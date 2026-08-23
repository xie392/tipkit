import type { ComponentPropsWithoutRef } from "react";
import { CodeBlock } from "./code-block";

/**
 * MDX 自定义组件映射：
 * - pre：shiki 高亮 + 复制按钮（CodeBlock）
 * - table：套 docs 表格样式
 * - a：外部链接新标签页打开，站内锚点保持原页
 */
export const mdxComponents = {
  pre: (props: ComponentPropsWithoutRef<"pre"> & Record<string, unknown>) => (
    <CodeBlock {...props} />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="docs-table-wrap">
      <table className="docs-table" {...props} />
    </div>
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => {
    const external = typeof props.href === "string" && props.href.startsWith("http");
    return (
      <a {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />
    );
  },
};
