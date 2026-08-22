import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../../src/index";
import { filterInsertActions, getInsertActions, getSlashCommandState } from "../../src/slash-menu/actions";

describe("filterInsertActions（斜杠菜单过滤）", () => {
  const actions = getInsertActions({ editor: null as never }).map((a) => a);

  it("空 query 返回全部", () => {
    expect(filterInsertActions(actions, "")).toHaveLength(actions.length);
  });

  it("中文单字前缀匹配", () => {
    const result = filterInsertActions(actions, "图");
    expect(result.some((a) => a.label === "图片")).toBe(true);
  });

  it("多关键字包含匹配（别名/描述）", () => {
    const result = filterInsertActions(actions, "todo");
    expect(result.some((a) => a.id === "taskList")).toBe(true);
  });

  it("无匹配返回空数组", () => {
    expect(filterInsertActions(actions, "zzzz不存在")).toHaveLength(0);
  });
});

describe("getInsertActions（命令列表）", () => {
  it("icon 为字符串（消费方映射），不依赖图标库", () => {
    const editor = new Editor({
      extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    });
    const actions = getInsertActions({ editor });
    expect(actions.length).toBeGreaterThan(10);
    expect(typeof actions[0].icon).toBe("string");
    expect(actions.filter((a) => a.available).length).toBeGreaterThan(5);
    editor.destroy();
  });
});

describe("getSlashCommandState", () => {
  it("无选区（编辑器初始态）返回 inactive", () => {
    const editor = new Editor({
      extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
      content: "普通文本",
    });
    const state = getSlashCommandState(editor);
    expect(state.active).toBe(false);
    editor.destroy();
  });
});
