import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Callout } from "../../src/callout/callout";
import { Katex } from "../../src/katex/katex";
import { Columns, Column } from "../../src/columns/columns";
import { Details, DetailsSummary, DetailsContent } from "../../src/details/details";
import { Status } from "../../src/status/status";
import { Iframe } from "../../src/iframe/iframe";
import { Video } from "../../src/video/video";
import { Attachment } from "../../src/attachment/attachment";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Markdown,
      Callout,
      Katex,
      Columns,
      Column,
      Details,
      DetailsSummary,
      DetailsContent,
      Status,
      Iframe,
      Video,
      Attachment,
    ],
    content: "<p></p>",
  });
}

/** 设置 JSON → 导出 markdown → 重新解析 → 对比结构 */
function roundTrip(editor: Editor, json: JSONContent) {
  editor.commands.setContent(json);
  const md = editor.getMarkdown();
  const parsed = editor.storage.markdown.manager.parse(md) as JSONContent;
  return { md, parsed };
}

describe("自定义节点 Markdown 双向转换", () => {
  it("katex：块级 $$..$$ 单行 / 多行", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        { type: "katex", attrs: { text: "E=mc^2" } },
        { type: "katex", attrs: { text: "a\n\\times b" } },
      ],
    });
    expect(md).toContain("$$E=mc^2$$");
    expect(md).toContain("$$\na\n\\times b\n$$");
    const katexNodes = JSON.stringify(parsed).match(/"type":"katex"/g);
    expect(katexNodes?.length).toBe(2);
    expect(parsed.content?.[0].attrs?.text).toBe("E=mc^2");
    editor.destroy();
  });

  it("callout：:::callout 围栏保留 variant / emoji", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "warning", emoji: "⚠️" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "注意" }] }],
        },
      ],
    });
    expect(md).toContain(":::callout");
    expect(md).toContain('variant="warning"');
    const callout = parsed.content?.[0];
    expect(callout?.type).toBe("callout");
    expect(callout?.attrs?.variant).toBe("warning");
    expect(JSON.stringify(callout)).toContain("注意");
    editor.destroy();
  });

  it("columns：嵌套 :::columns / :::column", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        {
          type: "columns",
          attrs: { layout: "two-column" },
          content: [
            {
              type: "column",
              attrs: { position: "left" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "左列" }] }],
            },
            {
              type: "column",
              attrs: { position: "right" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "右列" }] }],
            },
          ],
        },
      ],
    });
    expect(md).toContain(":::columns");
    expect((md.match(/:::column\b/g) || []).length).toBe(2);
    const columns = parsed.content?.[0];
    expect(columns?.type).toBe("columns");
    expect(columns?.content?.length).toBe(2);
    expect(columns?.content?.[0].attrs?.position).toBe("left");
    expect(JSON.stringify(columns)).toContain("左列");
    expect(JSON.stringify(columns)).toContain("右列");
    editor.destroy();
  });

  it("details：嵌套围栏 + open 布尔往返", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        {
          type: "details",
          attrs: { open: true },
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "标题" }] },
            {
              type: "detailsContent",
              content: [{ type: "paragraph", content: [{ type: "text", text: "内容" }] }],
            },
          ],
        },
        {
          type: "details",
          attrs: { open: false },
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "收起" }] },
            {
              type: "detailsContent",
              content: [{ type: "paragraph", content: [{ type: "text", text: "隐藏" }] }],
            },
          ],
        },
      ],
    });
    expect(md).toContain(":::details {open}");
    expect(md).toContain(":::details {open=\"false\"}");
    expect(md).toContain(":::detailsSummary");
    expect(md).toContain(":::detailsContent");
    const first = parsed.content?.[0];
    const second = parsed.content?.[1];
    expect(first?.attrs?.open).toBe(true);
    expect(second?.attrs?.open).toBe(false);
    expect(JSON.stringify(parsed)).toContain("标题");
    expect(JSON.stringify(parsed)).toContain("内容");
    editor.destroy();
  });

  it("status：行内 shortcode 往返", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "前 " },
            { type: "status", attrs: { text: "进行中", color: "#2f6fed" } },
            { type: "text", text: " 后" },
          ],
        },
      ],
    });
    expect(md).toContain('[status text="进行中" color="#2f6fed"]');
    const paragraph = parsed.content?.[0];
    expect(paragraph?.content?.some((n) => n.type === "status")).toBe(true);
    const status = paragraph?.content?.find((n) => n.type === "status");
    expect(status?.attrs?.text).toBe("进行中");
    editor.destroy();
  });

  it("iframe / video / attachment：atom 围栏往返", () => {
    const editor = makeEditor();
    const { md, parsed } = roundTrip(editor, {
      type: "doc",
      content: [
        { type: "iframe", attrs: { url: "https://example.com", width: "100%", height: 360 } },
        { type: "video", attrs: { src: "https://example.com/a.mp4" } },
        {
          type: "attachment",
          attrs: {
            fileName: "报告",
            fileSize: 10240,
            fileType: "application/pdf",
            fileExt: "pdf",
            url: "https://example.com/报告.pdf",
          },
        },
      ],
    });
    expect(md).toContain(":::iframe");
    expect(md).toContain('height="360"');
    expect(md).toContain(":::video");
    expect(md).toContain(":::attachment");
    expect(md).toContain('fileName="报告"');
    const iframe = parsed.content?.find((n) => n.type === "iframe");
    const video = parsed.content?.find((n) => n.type === "video");
    const attachment = parsed.content?.find((n) => n.type === "attachment");
    expect(iframe?.attrs?.url).toBe("https://example.com");
    expect(iframe?.attrs?.height).toBe(360);
    expect(video?.attrs?.src).toBe("https://example.com/a.mp4");
    expect(attachment?.attrs?.fileSize).toBe(10240);
    expect(attachment?.attrs?.fileExt).toBe("pdf");
    editor.destroy();
  });
});
