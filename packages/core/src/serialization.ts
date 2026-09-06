import type { Editor } from "@tiptap/react";
import { DOMSerializer, DOMParser as PMDOMParser } from "@tiptap/pm/model";

/**
 * 序列化契约：JSON ↔ HTML ↔ Markdown（M1 已实现）。
 * - Markdown：@tiptap/markdown v3 的 MarkdownManager（storage.markdown.manager）
 * - HTML：@tiptap/pm/model 的 DOMSerializer / DOMParser
 */
export interface TipKitSerializer {
  /** JSON（ProseMirror doc）→ HTML 字符串 */
  toHTML(json: Record<string, unknown>): string;
  /** HTML → JSON（用于粘贴/导入） */
  fromHTML(html: string): Record<string, unknown>;
  /** JSON → Markdown（用于复制为 Markdown / 导出） */
  toMarkdown(json: Record<string, unknown>): string;
  /** Markdown → JSON（用于粘贴 Markdown） */
  fromMarkdown(markdown: string): Record<string, unknown>;
}

/** MarkdownManager 的最小类型（避免 core 依赖 @tiptap/markdown 包） */
interface MarkdownManagerLike {
  serialize(docOrContent: Record<string, unknown>): string;
  parse(markdown: string): Record<string, unknown>;
}

function getMarkdownManager(editor: Editor): MarkdownManagerLike {
  // storage 类型不含 markdown 字段（由 @tiptap/markdown 扩展声明），此处窄化访问
  const storage = editor.storage as typeof editor.storage & {
    markdown?: { manager?: MarkdownManagerLike };
  };
  const manager = storage.markdown?.manager;
  if (!manager) {
    throw new Error(
      "TipKit 序列化需要 Markdown 扩展：请通过 createBasicExtensions() 或单独引入 @tiptap/markdown",
    );
  }
  return manager;
}

/* ------------------------------------------------------------------ */
/* 目录（TOC）导出展开                                                  */
/* ------------------------------------------------------------------ */
/* tableOfContentsNode（@tipkit/extensions/toc）是无内容的 atom 节点，
 * Markdown 没有目录语法；导出时展开为真实的标题列表（按层级嵌套），
 * 导入侧仍识别 [TOC] 占位符还原为目录节点。此处按节点 type 名字符串
 * 匹配，不依赖 @tiptap/extensions。 */

interface JsonLike {
  type?: string;
  attrs?: Record<string, unknown> | null;
  content?: JsonLike[] | null;
  [key: string]: unknown;
}

interface TocHeading {
  level: number;
  text: string;
}

function collectHeadings(json: JsonLike, out: TocHeading[]): TocHeading[] {
  if (json.type === "heading") {
    const text = (json.content ?? [])
      .map((c) => (typeof c.text === "string" ? c.text : ""))
      .join("");
    out.push({ level: Number(json.attrs?.level) || 1, text });
    return out;
  }
  for (const child of json.content ?? []) collectHeadings(child, out);
  return out;
}

/** 按标题层级构建嵌套 bulletList，返回 [节点, 下一个未消费的下标] */
function buildTocLevel(
  headings: TocHeading[],
  start: number,
  level: number,
): [JsonLike, number] {
  const items: JsonLike[] = [];
  let i = start;
  while (i < headings.length && headings[i].level >= level) {
    if (headings[i].level > level) {
      const [sub, next] = buildTocLevel(headings, i, headings[i].level);
      const prev = items[items.length - 1];
      if (prev) prev.content?.push(sub);
      i = next;
      continue;
    }
    items.push({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text: headings[i].text }] },
      ],
    });
    i++;
  }
  return [{ type: "bulletList", content: items }, i];
}

/** 深度遍历：把 tableOfContentsNode 替换为展开的标题列表（无标题时保留原节点） */

/** TOC 展开的入口：从文档根收集标题，再替换所有 TOC 节点 */
function expandTocsInDoc(doc: JsonLike): JsonLike {
  const hasToc = JSON.stringify(doc).includes('"tableOfContentsNode"');
  if (!hasToc) return doc;
  const headings = collectHeadings(doc, []);
  if (!headings.length) return doc;

  const replace = (node: JsonLike): JsonLike => {
    if (node.type === "tableOfContentsNode") {
      const [list] = buildTocLevel(headings, 0, headings[0].level);
      return list;
    }
    if (node.content?.length) node.content = node.content.map(replace);
    return node;
  };
  doc.content = (doc.content ?? []).map(replace);
  return doc;
}

/** 创建序列化器。注意：必须在编辑器实例创建后调用（依赖 schema 与 storage）。 */
export function createSerializer(editor: Editor): TipKitSerializer {
  return {
    toHTML: (json) => {
      const doc = editor.schema.nodeFromJSON(json);
      const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content);
      const div = document.createElement("div");
      div.appendChild(fragment);
      return div.innerHTML;
    },
    fromHTML: (html) => {
      const dom = new window.DOMParser().parseFromString(html, "text/html");
      const doc = PMDOMParser.fromSchema(editor.schema).parse(dom.body);
      return doc.toJSON() as Record<string, unknown>;
    },
    toMarkdown: (json) => {
      // TOC 节点展开为标题列表；深拷贝避免改动调用方传入的 JSON
      const expanded = expandTocsInDoc(
        JSON.parse(JSON.stringify(json)) as JsonLike,
      );
      return getMarkdownManager(editor).serialize(
        expanded as Record<string, unknown>,
      );
    },
    fromMarkdown: (markdown) => getMarkdownManager(editor).parse(markdown),
  };
}
