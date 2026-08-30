import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

afterEach(() => {
  // 各测试自行 destroy
});

describe("编辑器边界行为", () => {
  it("空内容初始化不报错，自动补一个空段落", () => {
    const editor = makeEditor("");
    expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(1);
    expect(editor.isEmpty).toBe(true);
    editor.destroy();
  });

  it("getHTML 后可 setContent 往返，不丢节点", () => {
    const original = "<h2>标题</h2><p>正文</p><ul><li><p>列表项</p></li></ul>";
    const editor = makeEditor(original);
    const html = editor.getHTML();
    expect(html).toContain("<h2");
    expect(html).toContain("标题");
    editor.destroy();

    const editor2 = makeEditor(html);
    const roundTripped = editor2.getHTML();
    expect(roundTripped).toContain("标题");
    expect(roundTripped).toContain("正文");
    expect(roundTripped).toContain("列表项");
    editor2.destroy();
  });

  it("撤销/重做栈正常工作", () => {
    const editor = makeEditor();
    editor.commands.insertContent("第一行");
    editor.commands.insertContent(" 第二行");
    expect(editor.getHTML()).toContain("第二行");
    editor.commands.undo();
    expect(editor.getHTML()).not.toContain("第二行");
    editor.commands.redo();
    expect(editor.getHTML()).toContain("第二行");
    editor.destroy();
  });

  it("连续切换同一种块类型幂等（toggle 开关）", () => {
    const editor = makeEditor();
    editor.chain().focus().toggleBulletList().run();
    expect(editor.isActive("bulletList")).toBe(true);
    editor.chain().focus().toggleBulletList().run();
    expect(editor.isActive("bulletList")).toBe(false);
    editor.destroy();
  });

  it("粗体/斜体/删除线 mark 可切换", () => {
    const editor = makeEditor();
    editor.commands.insertContent("hello");
    editor.commands.selectAll();
    editor.chain().focus().toggleBold().run();
    expect(editor.isActive("bold")).toBe(true);
    editor.chain().focus().toggleItalic().run();
    expect(editor.isActive("italic")).toBe(true);
    editor.chain().focus().toggleStrike().run();
    expect(editor.isActive("strike")).toBe(true);
    editor.destroy();
  });

  it("setEditable 可切换只读模式", () => {
    const editor = makeEditor("<p>内容</p>");
    expect(editor.isEditable).toBe(true);
    editor.setEditable(false);
    expect(editor.isEditable).toBe(false);
    editor.setEditable(true);
    expect(editor.isEditable).toBe(true);
    editor.destroy();
  });

  it("多次 destroy 不抛错", () => {
    const editor = makeEditor();
    editor.destroy();
    expect(() => editor.destroy()).not.toThrow();
  });
});

describe("HTML 解析与渲染往返", () => {
  it("标题层级 1-6 完整保留", () => {
    const cases = [1, 2, 3, 4, 5, 6];
    for (const level of cases) {
      const editor = makeEditor(`<h${level}>H${level}</h${level}>`);
      expect(editor.isActive("heading", { level })).toBe(true);
      expect(editor.getHTML().toLowerCase()).toContain(`<h${level}`);
      editor.destroy();
    }
  });

  it("列表嵌套结构保留", () => {
    const html = '<ul><li><p>一</p><ul><li><p>1.1</p></li></ul></li><li><p>二</p></li></ul>';
    const editor = makeEditor(html);
    expect(editor.getHTML()).toContain("一");
    expect(editor.getHTML()).toContain("1.1");
    expect(editor.getHTML()).toContain("二");
    editor.destroy();
  });

  it("blockquote 保留引用内容", () => {
    const editor = makeEditor("<blockquote><p>引用文本</p></blockquote>");
    expect(editor.isActive("blockquote")).toBe(true);
    expect(editor.getHTML()).toContain("引用文本");
    editor.destroy();
  });

  it("表格结构保留行列", () => {
    const html =
      "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>";
    const editor = makeEditor(html);
    expect(editor.isActive("table")).toBe(true);
    const out = editor.getHTML();
    expect(out).toContain("A");
    expect(out).toContain("1");
    editor.destroy();
  });

  it("行内代码 mark 保留", () => {
    const editor = makeEditor("<p>文字 <code>code</code> 结尾</p>");
    expect(editor.getHTML()).toContain("<code>code</code>");
    editor.destroy();
  });

  it("链接 mark 保留 href", () => {
    const editor = makeEditor('<p><a href="https://example.com">链接</a></p>');
    expect(editor.getHTML()).toContain('href="https://example.com"');
    editor.destroy();
  });
});

describe("命令链健壮性", () => {
  it("在空文档上执行块级命令不报错", () => {
    const editor = makeEditor("");
    expect(() => editor.chain().focus().toggleHeading({ level: 1 }).run()).not.toThrow();
    expect(editor.isActive("heading", { level: 1 })).toBe(true);
    editor.destroy();
  });

  it("在 atom 节点（附件/katex）后可正常追加段落", () => {
    const editor = makeEditor();
    editor.chain().focus().setAttachment().run();
    editor.commands.focus("end");
    editor.commands.insertContent("后续文本");
    expect(editor.getHTML()).toContain("后续文本");
    editor.destroy();
  });

  it("insertContent 插入非法节点名时不崩溃（抛错或忽略）", () => {
    const editor = makeEditor();
    expect(() => {
      try {
        editor.commands.insertContent({ type: "__not_exist__" });
      } catch {
        // schema 校验失败抛错是可接受行为
      }
    }).not.toThrow();
    editor.destroy();
  });

  it("setContent 多次调用不累积残留", () => {
    const editor = makeEditor("<p>第一次</p>");
    editor.commands.setContent("<p>第二次</p>");
    expect(editor.getHTML()).not.toContain("第一次");
    expect(editor.getHTML()).toContain("第二次");
    editor.destroy();
  });
});

describe("Schema 约束", () => {
  it("attachment/katex/iframe/imageBlock 均为 block 级", () => {
    const editor = makeEditor();
    for (const name of ["attachment", "katex", "iframe", "imageBlock"]) {
      const node = editor.schema.nodes[name];
      expect(node, `${name} 应注册`).toBeDefined();
      const groups = node.spec.group as string;
      expect(groups).toContain("block");
    }
    editor.destroy();
  });

  it("callout/content 为 paragraph+（不允许空）", () => {
    const editor = makeEditor();
    expect(editor.schema.nodes.callout.spec.content).toBe("paragraph+");
    editor.destroy();
  });

  it("columns 至少包含一个 column（column+，支持任意列数）", () => {
    const editor = makeEditor();
    expect(editor.schema.nodes.columns.spec.content).toBe("column+");
    editor.destroy();
  });
});
