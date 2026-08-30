import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions, replaceSlashWithEmpty, Emoji } from "@tipkit/extensions";
import { getEmojiSuggestionState, EmojiSuggestion } from "../src/emoji/emoji-suggestion";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function makeEditor() {
  return new Editor({
    element: document.createElement("div"),
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions(), Emoji],
    content: "",
  });
}

describe("emoji 建议浮层", () => {
  it("手动输入 : 触发浮层状态", () => {
    const editor = makeEditor();
    editor.commands.insertContent(":");
    expect(getEmojiSuggestionState(editor).active).toBe(true);
    editor.destroy();
  });

  it("斜杠命令链后浮层状态 active 且浮层渲染，Enter 精确插入高亮项一次", async () => {
    const editor = makeEditor();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<EmojiSuggestion editor={editor} />);
    });

    // 模拟斜杠菜单 emoji action 的 run 等价代码
    await act(async () => {
      editor.commands.insertContent("/表情");
      replaceSlashWithEmpty(editor);
      editor.chain().focus().insertContent(":").run();
    });

    // 浮层状态与 DOM 均应就绪
    expect(getEmojiSuggestionState(editor).active).toBe(true);
    expect(document.querySelectorAll(".tk-emoji-menu").length).toBe(1);
    expect(document.querySelectorAll(".tk-emoji-cell").length).toBeGreaterThan(0);

    // Enter 插入高亮项（一次），浮层随后关闭
    await act(async () => {
      editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const json = JSON.stringify(editor.getJSON());
    const emojiCount = (json.match(/"type":"emoji"/g) ?? []).length;
    expect(emojiCount).toBe(1);
    expect(getEmojiSuggestionState(editor).active).toBe(false);
    expect(document.querySelectorAll(".tk-emoji-menu").length).toBe(0);

    root.unmount();
    editor.destroy();
  }, 20000);
});
