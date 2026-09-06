import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { createSerializer } from "@tipkit/core";
import { TableOfContentsNode } from "../../src/toc/toc-node";

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, Markdown, TableOfContentsNode],
    content: "<p></p>",
  });
}

describe("TOC 的 Markdown 展开", () => {
  it("TOC 节点展开为按层级嵌套的标题列表", () => {
    const editor = makeEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "总览" }] },
        { type: "tableOfContentsNode" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "安装" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "依赖" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "使用" }] },
      ],
    });
    const serializer = createSerializer(editor);
    const md = serializer.toMarkdown(editor.getJSON());
    expect(md).not.toContain('"tableOfContentsNode"');
    const tocIdx = md.indexOf("- 总览");
    expect(tocIdx).toBeGreaterThan(-1);
    // 嵌套层级：安装/使用比总览深一级，依赖更深一级
    const lines = md.slice(tocIdx).split("\n");
    const depth = (line: string) => line.indexOf("- ");
    expect(depth(lines[0])).toBe(0);
    const installIdx = lines.findIndex((l) => l.includes("- 安装"));
    const depIdx = lines.findIndex((l) => l.includes("- 依赖"));
    const usageIdx = lines.findIndex((l) => l.includes("- 使用"));
    expect(depth(lines[installIdx])).toBeGreaterThan(depth(lines[0]));
    expect(depth(lines[depIdx])).toBeGreaterThan(depth(lines[installIdx]));
    expect(depth(lines[usageIdx])).toBe(depth(lines[installIdx]));
    // 原始 JSON 不被改动（深拷贝）
    expect(editor.getJSON().content?.some((n) => n.type === "tableOfContentsNode")).toBe(true);
    editor.destroy();
  });

  it("无标题时 TOC 保留为 [TOC] 占位符（可被导入还原）", () => {
    const editor = makeEditor();
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "tableOfContentsNode" }],
    });
    const serializer = createSerializer(editor);
    const md = serializer.toMarkdown(editor.getJSON());
    expect(md).toContain("[TOC]");
    // 导入还原
    const parsed = serializer.fromMarkdown(md);
    expect(JSON.stringify(parsed)).toContain('"tableOfContentsNode"');
    editor.destroy();
  });
});
