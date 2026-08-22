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
    toMarkdown: (json) => getMarkdownManager(editor).serialize(json),
    fromMarkdown: (markdown) => getMarkdownManager(editor).parse(markdown),
  };
}
