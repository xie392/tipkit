import { describe, expect, it, afterEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions, ImportDoc } from "../src/index";

function makeEditor(extra: Parameters<typeof ImportDoc.configure>[0] = {}) {
  return new Editor({
    extensions: [
      ...createBasicExtensions(),
      ...createAdvancedExtensions(),
      ImportDoc.configure(extra),
    ],
    content: "<p>原始</p>",
  });
}

function makeFile(name = "doc.docx"): File {
  return new File(["fake"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImportDoc 文档导入", () => {
  it("未配置 onConvert 时命令返回 false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = makeEditor();
    const ok = await editor.commands.importDocument(makeFile());
    expect(ok).toBe(false);
    expect(editor.getHTML()).toContain("原始");
    expect(warn).toHaveBeenCalled();
    editor.destroy();
  });

  it("onConvert 返回 HTML 后替换编辑器内容", async () => {
    const file = makeFile();
    const onConvert = vi.fn().mockResolvedValue("<h1>导入标题</h1><p>导入正文</p>");
    const editor = makeEditor({ onConvert });

    const ok = await editor.commands.importDocument(file);
    expect(ok).toBe(true);
    expect(onConvert).toHaveBeenCalledWith(file);
    expect(editor.getHTML()).toContain("导入标题");
    expect(editor.getHTML()).not.toContain("原始");
    editor.destroy();
  });

  it("onConvert 返回 null 时导入失败且内容不变", async () => {
    const editor = makeEditor({ onConvert: () => Promise.resolve(null) });

    const ok = await editor.commands.importDocument(makeFile());
    expect(ok).toBe(false);
    expect(editor.getHTML()).toContain("原始");
    editor.destroy();
  });

  it("onConvert 抛错时导入失败且内容不变", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const editor = makeEditor({ onConvert: () => Promise.reject(new Error("boom")) });

    const ok = await editor.commands.importDocument(makeFile());
    expect(ok).toBe(false);
    expect(editor.getHTML()).toContain("原始");
    expect(error).toHaveBeenCalled();
    editor.destroy();
  });

  it("不在 allowedMimeTypes 内的文件类型被拒绝", async () => {
    const editor = makeEditor({
      onConvert: () => Promise.resolve("<p>不该被调用</p>"),
    });
    const file = new File(["x"], "a.exe", { type: "application/x-msdownload" });

    const ok = await editor.commands.importDocument(file);
    expect(ok).toBe(false);
    expect(editor.getHTML()).toContain("原始");
    editor.destroy();
  });
});
