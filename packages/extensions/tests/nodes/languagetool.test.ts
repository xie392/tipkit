import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, LanguageTool, languageToolMetaKey, collectTextSegments, mapMatchToDoc } from "../../src/index";

describe("LanguageTool 语法检查", () => {
  describe("collectTextSegments", () => {
    it("拼接纯文本并记录每段的文档位置", () => {
      const editor = new Editor({
        extensions: [...createBasicExtensions()],
        content: "<p>hello world</p><p>second block</p>",
      });
      const { fullText, segments } = collectTextSegments(editor.state.doc);
      // 段间以 \n\n 分隔（trailing node 可能追加空段）
      expect(fullText.startsWith("hello world\n\nsecond block")).toBe(true);
      expect(segments[0]).toMatchObject({ text: "hello world", offset: 0, pos: 1 });
      const second = segments.find((s) => s.text.startsWith("second block"))!;
      expect(second.offset).toBeGreaterThan(0);
      editor.destroy();
    });
  });

  describe("mapMatchToDoc", () => {
    const segments = [
      { text: "hello world", offset: 0, pos: 1 },
      { text: "second block", offset: 13, pos: 16 },
    ];

    it("把纯文本偏移映射为文档位置", () => {
      const m = mapMatchToDoc({ offset: 6, length: 5, message: "x" }, segments)!;
      expect(m.from).toBe(7); // 1 + 6
      expect(m.to).toBe(12);
    });

    it("跨界（跨 inline 节点）匹配被裁剪为 null", () => {
      // 偏移 10..16 跨越 "world" 与块间 \n\n
      const m = mapMatchToDoc({ offset: 9, length: 6, message: "x" }, segments);
      expect(m).toBeNull();
    });

    it("起点不在任何段内返回 null", () => {
      expect(mapMatchToDoc({ offset: 999, length: 2, message: "x" }, segments)).toBeNull();
    });
  });

  it("applyLanguageToolSuggestion / dismiss / clear 命令行为", () => {
    const editor = new Editor({
      extensions: [...createBasicExtensions(), LanguageTool],
      content: "<p>Teh cat</p>",
    });
    // 模拟检查结果写入插件状态：offset 0..3 "Teh" → from 1..4
    const { view } = editor;
    view.dispatch(
      editor.state.tr.setMeta(languageToolMetaKey, {
        checking: false,
        error: null,
        matches: [
          { offset: 0, length: 3, message: "Spelling", replacements: [{ value: "The" }], from: 1, to: 4 },
        ],
      }),
    );
    editor.commands.applyLanguageToolSuggestion(0);
    expect(editor.state.doc.textContent).toBe("The cat");

    // 注入新结果再测 dismiss / clear
    view.dispatch(
      editor.state.tr.setMeta(languageToolMetaKey, {
        checking: false,
        error: null,
        matches: [
          { offset: 0, length: 3, message: "a", from: 1, to: 4 },
          { offset: 4, length: 3, message: "b", from: 5, to: 8 },
        ],
      }),
    );
    editor.commands.dismissLanguageToolMatch(0);
    expect(view.state.plugins.find((p) => (p as any).key.includes("languageTool"))!.getState?.(editor.state) ?? null).toBeTruthy();
    editor.commands.clearLanguageToolMatches();
    const plugin = editor.state.plugins.find((p) => (p as any).key.includes("languageTool")) as any;
    const s = plugin.getState(editor.state);
    expect(s.matches).toHaveLength(0);
    expect(s.checking).toBe(false);
    editor.destroy();
  });

  it("checkLanguageTool 使用注入的 check 函数", async () => {
    let called = "";
    const editor = new Editor({
      extensions: [
        ...createBasicExtensions(),
        LanguageTool.configure({
          check: async (text) => {
            called = text;
            return [{ offset: 0, length: 3, message: "m", replacements: [{ value: "The" }] }];
          },
        }),
      ],
      content: "<p>Teh cat</p>",
    });
    editor.commands.checkLanguageTool();
    // 等待 Promise 链完成
    await new Promise((r) => setTimeout(r, 10));
    expect(called.startsWith("Teh cat")).toBe(true);
    const plugin = editor.state.plugins.find((p) => (p as any).key.includes("languageTool")) as any;
    const s = plugin.getState(editor.state);
    expect(s.matches).toHaveLength(1);
    expect(s.matches[0].from).toBe(1);
    expect(s.checking).toBe(false);
    editor.commands.applyLanguageToolSuggestion(0);
    expect(editor.state.doc.textContent).toBe("The cat");
    editor.destroy();
  });
});
