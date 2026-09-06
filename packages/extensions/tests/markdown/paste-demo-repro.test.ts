import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions, UniqueID } from "../../src";
import { sanitizeNodes } from "../../src/markdown/paste";

/** 回归：demo 完整扩展集合下，粘贴 Markdown 逐块转换；
 * 此前链接块解析出重复 link mark（link,link）导致整次插入失败、整段退回纯文本 */
function buildDemoEditor() {
  return new Editor({
    extensions: [...createBasicExtensions(), UniqueID, ...createAdvancedExtensions()],
    content: "<p></p>",
  });
}

const DEMO_PASTE = `## 一套逻辑，任意风格：开源富文本编辑器套件 TipKit

- **从零搭**：Tiptap 本身是无头的，足够灵活
- **用现成的**：省事

**先玩再读**：在线演示 👉 [https://tipkit-delta.vercel.app/demo](https://tipkit-delta.vercel.app/demo)

## 核心设计一：主题系统，换 CSS 就是换风格

\`\`\`typescript
import "@tipkit/themes/default.css"; // shadcn 标准 → tk-theme-default
\`\`\`
`;

function convertViaManager(editor: Editor, text: string) {
  const manager = (editor as unknown as { markdown?: { parse: (md: string) => { type?: string; content?: unknown[] } } }).markdown;
  if (!manager) throw new Error("markdown manager missing");
  const results: Array<{ type?: string; content?: unknown[] }> = [];
  for (const seg of text.split(/\n{2,}/)) {
    try {
      const parsed = manager.parse(seg);
      const content = parsed.type === "doc" && Array.isArray(parsed.content) ? parsed.content : [parsed];
      results.push(...(sanitizeNodes(content as never) as Array<{ type?: string }>));
    } catch {
      results.push({ type: "paragraph", content: [{ type: "text", text: seg }] });
    }
  }
  return results;
}

describe("demo paste convert", () => {
  it("链接块不再产生重复 link mark，整段可插入并转换为富文本", () => {
    const editor = buildDemoEditor();
    const nodes = convertViaManager(editor, DEMO_PASTE);
    // 重复 link mark 的块此前会让 insertContent 抛 RangeError
    expect(() => editor.commands.insertContent(nodes as never)).not.toThrow();

    const html = editor.getHTML();
    expect(html).toContain("一套逻辑，任意风格：开源富文本编辑器套件 TipKit");
    expect(html).toContain("<h2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<a ");
    expect(html).toContain("tk-theme-default");
  });
});
