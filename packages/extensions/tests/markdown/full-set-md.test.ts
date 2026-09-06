import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { createBasicExtensions } from "../../src/basic";
import { createAdvancedExtensions } from "../../src/advanced";

describe("完整扩展集合 Markdown 导出", () => {
  it("callout/katex/details/status 等出现在导出中", () => {
    const editor = new Editor({
      extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
      content: "<p></p>",
    });
    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph", content: [{ type: "text", text: "提示" }] }] },
        { type: "katex", attrs: { text: "E=mc^2" } },
        { type: "status", attrs: { text: "进行中", color: "#2f6fed" } },
        { type: "iframe", attrs: { url: "https://example.com", width: "100%", height: 360 } },
        { type: "video", attrs: { src: "https://example.com/a.mp4" } },
        { type: "tableOfContentsNode" },
        {
          type: "details",
          attrs: { open: true },
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "折叠标题" }] },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    });
    const md = editor.getMarkdown();
    expect(md).toContain(":::callout");
    expect(md).toContain("$$E=mc^2$$");
    expect(md).toContain("[status");
    expect(md).toContain(":::iframe");
    expect(md).toContain(":::video");
    expect(md).toContain("[TOC]");
    expect(md).toContain(":::details");
    editor.destroy();
  });
});
