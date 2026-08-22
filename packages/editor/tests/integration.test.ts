import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";

/**
 * 客户端编辑器创建集成测试。
 * 回归保护：demo 曾报 "Adding different instances of a keyed plugin (history$)"
 * —— useTipKitEditor 默认加 StarterKit，而 createBasicExtensions() 也含 StarterKit，
 * 两个 History 插件实例冲突。本测试模拟客户端创建完整扩展组合。
 */
describe("扩展装配集成（防 keyed plugin 冲突）", () => {
  it("basic + advanced 组合可创建编辑器", () => {
    const editor = new Editor({
      extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
      content: "**加粗** 文本",
    });
    expect(editor).toBeTruthy();
    expect(editor.getText()).toContain("加粗");
    editor.destroy();
  });

  it("重复调用扩展工厂返回同一批实例（单例缓存）", () => {
    const a = createBasicExtensions();
    const b = createBasicExtensions();
    expect(a).toBe(b);
    expect(createAdvancedExtensions()).toBe(createAdvancedExtensions());
  });
});
