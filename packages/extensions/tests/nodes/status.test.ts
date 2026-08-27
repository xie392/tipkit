import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import {
  createBasicExtensions,
  createAdvancedExtensions,
} from "../../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

function findFirstNode(editor: Editor, name: string) {
  let found: { node: any; pos: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name) {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}

afterEach(() => {
  // 编辑器在各自测试中 destroy
});

describe("Status 状态标签节点", () => {
  it("setStatus 插入 inline atom 节点，默认属性齐全", () => {
    const editor = makeEditor();
    editor.chain().focus().setStatus().run();
    const found = findFirstNode(editor, "status");
    expect(found).not.toBeNull();
    expect(found!.node.type.isInline).toBe(true);
    expect(found!.node.type.isAtom).toBe(true);
    expect(found!.node.attrs).toEqual({ text: "待处理", color: "#ffcccc" });
    editor.destroy();
  });

  it("setStatus 可设置自定义属性", () => {
    const editor = makeEditor();
    editor.chain().focus().setStatus({ text: "已完成", color: "#d1fadf" }).run();
    const { node } = findFirstNode(editor, "status")!;
    expect(node.attrs.text).toBe("已完成");
    expect(node.attrs.color).toBe("#d1fadf");
    editor.destroy();
  });

  it("Status 可与普通文本混排", () => {
    const editor = makeEditor();
    editor.chain().focus().insertContent("前缀文本").setStatus().run();
    const found = findFirstNode(editor, "status");
    expect(found).not.toBeNull();
    const paragraph = editor.state.doc.firstChild!;
    const childTypes = paragraph.content.content.map((c: any) => c.type.name);
    expect(childTypes).toContain("text");
    expect(childTypes).toContain("status");
    expect(paragraph.textContent).toContain("前缀文本");
    editor.destroy();
  });

  it("getJSON 序列化包含 status 节点及属性", () => {
    const editor = makeEditor();
    editor.chain().focus().setStatus({ text: "已完成", color: "#d1fadf" }).run();
    const json = editor.getJSON();
    const statusNodes: any[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        if (n.type === "status") statusNodes.push(n);
        if (n.content) walk(n.content);
      }
    };
    walk([json]);
    expect(statusNodes).toHaveLength(1);
    expect(statusNodes[0]).toEqual({
      type: "status",
      attrs: { text: "已完成", color: "#d1fadf" },
    });
    editor.destroy();
  });

  it("HTML 序列化往返：data-text/data-color 可读回", () => {
    const editor = makeEditor();
    editor.chain().focus().setStatus({ text: "已完成", color: "#d1fadf" }).run();
    const html = editor.getHTML();
    expect(html).toContain("data-text");
    expect(html).toContain("data-color");
    expect(html).toContain("已完成");
    expect(html).toContain("#d1fadf");

    const editor2 = makeEditor(html);
    const { node } = findFirstNode(editor2, "status")!;
    expect(node.attrs.text).toBe("已完成");
    expect(node.attrs.color).toBe("#d1fadf");
    editor2.destroy();
    editor.destroy();
  });

  it("updateStatus 更新 text 属性", () => {
    const editor = makeEditor();
    editor.chain().focus().setStatus().run();
    const found = findFirstNode(editor, "status")!;
    editor
      .chain()
      .focus()
      .setNodeSelection(found.pos)
      .updateStatus({ text: "进行中" })
      .run();
    const { node } = findFirstNode(editor, "status")!;
    expect(node.attrs.text).toBe("进行中");
    editor.destroy();
  });
});
