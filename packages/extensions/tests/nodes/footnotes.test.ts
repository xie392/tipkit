import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createFootnoteExtensions, Footnotes, FootnoteItem, FootnoteReference } from "../../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createFootnoteExtensions()],
    content,
  });
}

function findAll(editor: Editor, name: string) {
  const found: { node: any; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name) found.push({ node, pos });
    return true;
  });
  return found;
}

describe("Footnotes 脚注", () => {
  it("setFootnote 在光标处插入引用，并在文末创建容器与条目", () => {
    const editor = makeEditor("<p>hello</p>");
    editor.commands.setTextSelection(3); // "he|llo"
    editor.commands.setFootnote({ text: "这是脚注" });
    const refs = findAll(editor, "footnoteReference");
    const items = findAll(editor, "footnoteItem");
    expect(refs).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(refs[0].node.attrs.id).toBe(items[0].node.attrs.id);
    expect(items[0].node.textContent).toBe("这是脚注");
    // 引用在段落内，条目在文末 footnotes 容器内
    // （TrailingNode 会在其后补一个空段落，故不断言 lastChild）
    expect(findAll(editor, "footnotes")).toHaveLength(1);
    const container = findAll(editor, "footnotes")[0];
    expect(container.node.child(0).type.name).toBe("footnoteItem");
    editor.destroy();
  });

  it("setFootnote 缺省取选区文本作为脚注内容", () => {
    const editor = makeEditor("<p>abcdef</p>");
    editor.commands.setTextSelection({ from: 1, to: 4 }); // abc
    editor.commands.setFootnote();
    const items = findAll(editor, "footnoteItem");
    expect(items).toHaveLength(1);
    expect(items[0].node.textContent).toBe("abc");
    editor.destroy();
  });

  it("第二次 setFootnote 复用已有 footnotes 容器", () => {
    const editor = makeEditor("<p>x</p>");
    editor.commands.setFootnote({ text: "一" });
    editor.commands.setFootnote({ text: "二" });
    const containers = findAll(editor, "footnotes");
    expect(containers).toHaveLength(1);
    expect(findAll(editor, "footnoteItem")).toHaveLength(2);
    editor.destroy();
  });

  it("deleteFootnote 同时移除引用与条目", () => {
    const editor = makeEditor("<p>x</p>");
    editor.commands.setFootnote({ text: "note", id: "fn-1" });
    editor.commands.setTextSelection(1);
    editor.commands.setFootnote({ text: "note2", id: "fn-2" });
    expect(findAll(editor, "footnoteReference")).toHaveLength(2);

    editor.commands.deleteFootnote("fn-1");
    expect(findAll(editor, "footnoteReference")).toHaveLength(1);
    expect(findAll(editor, "footnoteItem").map((n) => n.node.attrs.id)).toEqual(["fn-2"]);
    editor.destroy();
  });

  it("focusFootnote 把光标移到对应条目", () => {
    const editor = makeEditor("<p>x</p>");
    editor.commands.setFootnote({ text: "target", id: "fn-t" });
    const ok = editor.commands.focusFootnote("fn-t");
    expect(ok).toBe(true);
    const { $from } = editor.state.selection;
    let parentName = "";
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "footnoteItem" && pos + 1 <= $from.pos && $from.pos <= pos + node.nodeSize - 1) {
        parentName = node.type.name;
        return false;
      }
      return true;
    });
    expect(parentName).toBe("footnoteItem");
    editor.destroy();
  });

  it("退格删除引用后，文末孤儿条目自动清理", () => {
    const editor = makeEditor("<p>abcdef</p>");
    editor.commands.setFootnote({ text: "注1", id: "fn-a" });
    editor.commands.setTextSelection(1);
    editor.commands.setFootnote({ text: "注2", id: "fn-b" });
    expect(findAll(editor, "footnoteItem")).toHaveLength(2);

    // 删掉第二个引用（inline atom 按节点范围删除，等价于退格删掉的结果）
    const refs = findAll(editor, "footnoteReference");
    const target = refs.find((n) => n.node.attrs.id === "fn-b")!;
    editor.view.dispatch(editor.state.tr.delete(target.pos, target.pos + target.node.nodeSize));
    expect(findAll(editor, "footnoteReference")).toHaveLength(1);

    // 孤儿条目 fn-b 与引用 fn-a 均在：只剩 1 条
    const items = findAll(editor, "footnoteItem");
    expect(items).toHaveLength(1);
    expect(items[0].node.attrs.id).toBe("fn-a");
    editor.destroy();
  });

  it("全部引用删光后，空 footnotes 容器一并移除", () => {
    const editor = makeEditor("<p>x</p>");
    editor.commands.setFootnote({ text: "only", id: "fn-1" });
    const ref = findAll(editor, "footnoteReference")[0]!;
    editor.view.dispatch(editor.state.tr.delete(ref.pos, ref.pos + ref.node.nodeSize));
    expect(findAll(editor, "footnoteReference")).toHaveLength(0);
    expect(findAll(editor, "footnoteItem")).toHaveLength(0);
    expect(findAll(editor, "footnotes")).toHaveLength(0);
    editor.destroy();
  });

  it("HTML 序列化往返：sup/div 结构可被 parseHTML 解析", () => {
    const editor = makeEditor(
      `<p>a<sup class="tk-footnote-ref" data-id="fn-9"></sup></p>` +
        `<div class="tk-footnotes"><div class="tk-footnote-item" data-id="fn-9"><p>n</p></div></div>`,
    );
    expect(findAll(editor, "footnoteReference")).toHaveLength(1);
    expect(findAll(editor, "footnoteItem")).toHaveLength(1);
    editor.destroy();
  });
});
