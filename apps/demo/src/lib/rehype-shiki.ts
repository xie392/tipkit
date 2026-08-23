import { codeToHast } from "shiki";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element, ElementContent } from "hast";

/** 语言白名单：MDX 中未标注或未知语言一律按纯文本高亮，避免 shiki 抛错 */
const SUPPORTED_LANGS = new Set([
  "text",
  "ts",
  "tsx",
  "js",
  "jsx",
  "bash",
  "sh",
  "css",
  "json",
  "yaml",
  "mdx",
  "html",
]);

/**
 * rehype 插件：服务端用 shiki 给 <pre><code> 语法高亮。
 * 高亮后的 token HTML 直接写入节点；同时把原始代码与语言写到
 * data-code / data-language 属性，供客户端复制按钮读取。
 */
export function rehypeShiki() {
  return async (tree: Root) => {
    const tasks: Promise<void>[] = [];

    visit(tree, (node) => {
      if (node.type !== "element" || node.tagName !== "pre") return;
      const codeNode = node.children[0];
      if (!codeNode || codeNode.type !== "element" || codeNode.tagName !== "code") return;

      const raw = toString(codeNode);
      const classes = (codeNode.properties?.className ?? []) as string[];
      const match = classes.find((c) => c.startsWith("language-"));
      const requested = match ? match.slice("language-".length) : "text";
      const lang = SUPPORTED_LANGS.has(requested) ? requested : "text";

      tasks.push(
        codeToHast(raw, { lang, theme: "github-dark" }).then((hast) => {
          const highlighted = hast.children[0];
          node.properties = {
            ...node.properties,
            className: ["tk-shiki", `tk-shiki-${lang}`],
            "data-language": lang,
            "data-code": raw,
          };
          node.children =
            highlighted && highlighted.type === "element"
              ? highlighted.children
              : [];
        }),
      );
    });

    await Promise.all(tasks);
  };
}

export type { Element, ElementContent };
