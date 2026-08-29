import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { UniqueID } from "../../src/unique-id/unique-id";

function makeEditor(content: string, opts?: Parameters<typeof UniqueID.configure>[0]) {
  return new Editor({
    extensions: [StarterKit, UniqueID.configure(opts)],
    content,
  });
}

/** onCreate 中带重试的补 id（等 view 挂载），测试需等待完成 */
function flushIds() {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

function collectIds(json: { attrs?: Record<string, unknown>; content?: unknown[] }): string[] {
  const out: string[] = [];
  const walk = (n: { attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (n.attrs?.id) out.push(String(n.attrs.id));
    n.content?.forEach((c) => walk(c as { attrs?: Record<string, unknown>; content?: unknown[] }));
  };
  walk(json);
  return out;
}

describe("UniqueID 基础能力", () => {
  it("初始文档中的目标节点自动补 id", async () => {
    const editor = makeEditor("<h1>标题</h1><p>段落</p>");
    await flushIds();
    const html = editor.getHTML();
    expect(html).toMatch(/<h1 [^>]*data-id="[^"]+"/);
    expect(html).toMatch(/<p [^>]*data-id="[^"]+"/);
    editor.destroy();
  });

  it("嵌套结构（blockquote 内段落）也会补 id", async () => {
    const editor = makeEditor("<blockquote><p>引用内段落</p></blockquote>");
    await flushIds();
    const html = editor.getHTML();
    expect(html).toMatch(/<blockquote [^>]*data-id="[^"]+"/);
    expect(html).toMatch(/<p [^>]*data-id="[^"]+"/);
    editor.destroy();
  });

  it("HTML 中已有 id 的节点不会被覆盖", async () => {
    const editor = makeEditor('<p data-id="my-fixed-id">固定</p>');
    await flushIds();
    const html = editor.getHTML();
    expect(html).toContain('data-id="my-fixed-id"');
    expect(html.match(/data-id/g)?.length).toBe(1);
    editor.destroy();
  });

  it("新建节点（回车分段）也会补 id", async () => {
    const editor = makeEditor("<p>第一段</p>");
    await flushIds();
    const before = collectIds(editor.getJSON());
    expect(before.length).toBe(1);

    editor.commands.setTextSelection({ from: 5, to: 5 });
    editor.commands.enter();
    const ids = collectIds(editor.getJSON());
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(before[0]);
    editor.destroy();
  });

  it("生成的 id 不重复", async () => {
    const editor = makeEditor("<p>a</p><p>b</p><p>c</p><p>d</p>");
    await flushIds();
    const ids = collectIds(editor.getJSON());
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    editor.destroy();
  });

  it("可配置自定义 generateID", async () => {
    let counter = 0;
    const editor = makeEditor("<p>一</p><p>二</p>", {
      generateID: () => `custom_${++counter}`,
    });
    await flushIds();
    const html = editor.getHTML();
    expect(html).toContain('data-id="custom_1"');
    expect(html).toContain('data-id="custom_2"');
    editor.destroy();
  });

  it("可配置 attributeName 与 types", async () => {
    const editor = makeEditor("<h2>标题</h2><p>正文</p>", {
      types: ["heading"],
      attributeName: "uid",
    });
    await flushIds();
    const html = editor.getHTML();
    expect(html).toMatch(/<h2 [^>]*data-uid="[^"]+"/);
    expect(html.match(/data-uid/g)?.length).toBe(1);
    editor.destroy();
  });

  it("编辑已有文档时旧节点 id 保持不变", async () => {
    const editor = makeEditor("<p>hello</p>");
    await flushIds();
    const before = collectIds(editor.getJSON());
    expect(before.length).toBe(1);

    editor.commands.insertContentAt(3, "x");
    const after = collectIds(editor.getJSON());
    expect(after).toContain(before[0]);
    editor.destroy();
  });
});
