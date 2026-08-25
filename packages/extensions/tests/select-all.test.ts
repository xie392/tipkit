import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

/** 模拟 Mod-a 按键，走与真实 keydown 相同的插件链；返回是否有处理器接管。 */
function pressModA(editor: Editor) {
  const isMac =
    typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  const event = new KeyboardEvent("keydown", {
    key: "a",
    ctrlKey: !isMac,
    metaKey: isMac,
  });
  return !!editor.view.someProp("handleKeyDown", (fn) => fn(editor.view, event));
}

function docTextRange(editor: Editor) {
  return {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
    docSize: editor.state.doc.content.size,
  };
}

describe("块级全选（首次选中当前文本块，再次全选全文）", () => {
  it("段落：首次 Mod-a 选中整段，再次全选全文", () => {
    const editor = makeEditor("<p>第一段</p><p>第二段</p>");
    editor.commands.setTextSelection(2); // 光标位于第一段内

    pressModA(editor);
    const first = editor.state.doc.child(0);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(1 + first.content.size);

    pressModA(editor);
    expect(docTextRange(editor)).toEqual({ from: 0, to: 10, docSize: 10 });
    editor.destroy();
  });

  it("标题块：首次 Mod-a 选中整个标题", () => {
    const editor = makeEditor("<h2>标题</h2><p>正文</p>");
    editor.commands.setTextSelection(2); // 光标位于标题内

    pressModA(editor);
    const heading = editor.state.doc.child(0);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(1 + heading.content.size);
    editor.destroy();
  });

  it("跨块选区：首次即全选全文", () => {
    const editor = makeEditor("<p>第一段</p><p>第二段</p>");
    editor.commands.setTextSelection({ from: 1, to: 8 }); // 选区跨两段

    pressModA(editor);
    expect(docTextRange(editor)).toEqual({ from: 0, to: 10, docSize: 10 });
    editor.destroy();
  });

  it("空文本块：直接全选全文", () => {
    const editor = makeEditor("<p></p><p>第二段</p>");
    editor.commands.setTextSelection(1); // 空段落内

    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("叶子块（分隔线）选中时：直接全选全文", () => {
    const editor = makeEditor("<p>a</p><hr><p>b</p>");
    editor.commands.setTextSelection(2); // 光标在 a 之后
    editor.commands.selectNodeForward(); // 选中 hr 节点

    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });
});
