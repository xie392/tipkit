import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions } from "../../src/basic";

/** 复现粘贴 convert 路径：逐块 manager.parse + insertContent */
describe("markdown paste convert", () => {
  it("逐块解析样例文本", () => {
    const editor = new Editor({
      extensions: createBasicExtensions(),
      content: "<p></p>",
    });
    const manager = (editor as unknown as { markdown?: { parse: (md: string) => unknown } }).markdown;
    expect(manager).toBeDefined();

    const md = [
      "## 一套逻辑：TipKit",
      "",
      "如果你正在挑编辑器：",
      "",
      "- **从零搭**：灵活",
      "- **用现成的**：省事",
      "",
      "![图片](https://i-blog.csdnimg.cn/direct/a.png)",
      "",
      "```typescript",
      'import "a";',
      "```",
    ].join("\n");

    // 模拟 convert：逐块解析，收集失败块
    const failures: string[] = [];
    const parsedSegments: Array<ReturnType<NonNullable<typeof manager>["parse"]>> = [];
    for (const seg of md.split("\n\n")) {
      try {
        parsedSegments.push(manager!.parse(seg));
      } catch (e) {
        failures.push(`${seg.slice(0, 20)}… → ${e}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log("failures:", failures);
    // eslint-disable-next-line no-console
    console.log("parsed:", JSON.stringify(parsedSegments, null, 2).slice(0, 2000));

    // 再试 insertContent 整体
    const nodes: Array<Record<string, unknown>> = [];
    for (const seg of md.split("\n\n")) {
      try {
        const parsed = manager!.parse(seg) as { type?: string; content?: unknown[] };
        const content = parsed.type === "doc" && Array.isArray(parsed.content) ? parsed.content : [parsed];
        nodes.push(...content);
      } catch {
        // ignore
      }
    }
    expect(() => editor.commands.insertContent(nodes)).not.toThrow();
    // eslint-disable-next-line no-console
    console.log("doc html:", editor.getHTML().slice(0, 800));
  });
});
