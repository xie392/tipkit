import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Emoji, findEmoji } from "../../src/emoji/emoji-node";

function makeEditor(content = "<p></p>") {
  return new Editor({
    extensions: [StarterKit, Emoji],
    content,
  });
}

describe("Emoji 节点", () => {
  it("schema 注册 emoji inline 节点", () => {
    const editor = makeEditor();
    expect(editor.schema.nodes.emoji).toBeDefined();
    editor.destroy();
  });

  it("insertEmoji 插入节点并渲染 tk-emoji", () => {
    const editor = makeEditor();
    const ok = editor.commands.insertEmoji("smile");
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('class="tk-emoji"');
    expect(html).toContain('data-name="smile"');
    expect(html).toContain("😄");
    editor.destroy();
  });

  it("insertEmoji 未知名字返回 false", () => {
    const editor = makeEditor();
    expect(editor.commands.insertEmoji("no_such_emoji")).toBe(false);
    editor.destroy();
  });

  it("输入规则：:smile: 自动替换为 emoji 节点", () => {
    const editor = makeEditor("<p></p>");
    // 模拟打字：先插入 ":smile"，再通过 handleTextInput 触发最后一个 ":" 的输入规则
    editor.commands.insertContent(":smile");
    const pos = editor.state.selection.from;
    editor.view.someProp("handleTextInput", (f) => f(editor.view, pos, pos, ":"));
    const html = editor.getHTML();
    expect(html).toContain('data-name="smile"');
    expect(html).toContain("😄");
    expect(html).not.toContain(":smile:");
    editor.destroy();
  });

  it("输入规则：未知短代码保持文本", () => {
    const editor = makeEditor("<p></p>");
    editor.commands.insertContent(":unknown_thing");
    const pos = editor.state.selection.from;
    const handled = editor.view.someProp("handleTextInput", (f) => f(editor.view, pos, pos, ":"));
    // 未知短代码规则不消费输入，补上最后输入的 ":"
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(":", pos));
    const html = editor.getHTML();
    expect(html).toContain(":unknown_thing:");
    expect(html).not.toContain("tk-emoji");
    editor.destroy();
  });

  it("HTML roundtrip 保留 emoji 节点", () => {
    const editor = makeEditor();
    editor.commands.insertEmoji("fire");
    const html = editor.getHTML();
    editor.destroy();

    const editor2 = makeEditor(html);
    const json = editor2.getJSON();
    const node = (json.content?.[0] as { content?: { type: string; attrs: { name: string } }[] })
      ?.content?.[0];
    expect(node?.type).toBe("emoji");
    expect(node?.attrs.name).toBe("fire");
    editor2.destroy();
  });

  it("findEmoji 大小写不敏感", () => {
    expect(findEmoji("SMILE")?.emoji).toBe("😄");
    expect(findEmoji(" fire ")?.emoji).toBe("🔥");
    expect(findEmoji("nope")).toBeUndefined();
  });

  it("Markdown 导出还原为 :name: 短代码", () => {
    const editor = new Editor({
      extensions: [StarterKit, Emoji, Markdown],
      content: "<p>心情：</p>",
    });
    editor.commands.insertEmoji("joy");
    const storage = editor.storage as typeof editor.storage & {
      markdown?: { manager?: { serialize: (json: unknown) => string } };
    };
    const manager = storage.markdown?.manager;
    expect(manager).toBeDefined();
    const md = manager!.serialize(editor.getJSON());
    expect(md).toContain(":joy:");
    editor.destroy();
  });
});
