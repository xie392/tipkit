import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  createBasicExtensions,
  createAdvancedExtensions,
  getSlashCommandState,
  replaceSlashWithEmpty,
  filterInsertActions,
  getInsertActions,
} from "../../src/index";
import { createT, zh } from "@tipkit/core";

/** 测试用中文翻译（恢复 i18n 改造前的 label 行为） */
const t = createT(zh);

function makeEditor(content = "<p></p>") {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

function typeSlash(editor: Editor, query = "") {
  editor.commands.insertContent(`/${query}`);
}

describe("getSlashCommandState — 顶层段落", () => {
  let editor: Editor;
  beforeEach(() => {
    editor = makeEditor("<p></p>");
  });
  afterEach(() => editor.destroy());

  it("空段落输入 / 后 active=true，query 为空", () => {
    typeSlash(editor);
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(true);
    expect(s.query).toBe("");
  });

  it("输入 /heading 后 query 为 heading", () => {
    typeSlash(editor, "heading");
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(true);
    expect(s.query).toBe("heading");
  });

  it("from/to 覆盖完整 /query 文本", () => {
    typeSlash(editor, "img");
    const s = getSlashCommandState(editor);
    expect(s.to - s.from).toBe(4);
  });

  it("段落首字符非 / 时 inactive", () => {
    editor.commands.insertContent("hello /world");
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(false);
  });

  it("空编辑器（无段落）不崩溃", () => {
    const empty = makeEditor("");
    expect(() => getSlashCommandState(empty)).not.toThrow();
    empty.destroy();
  });

  it("非折叠选区（有文本选中）返回 inactive", () => {
    typeSlash(editor, "test");
    editor.commands.selectAll();
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(false);
  });
});

describe("getSlashCommandState — 代码块/标题中不触发", () => {
  function setCursorInside(editor: Editor, typeName: string) {
    let nodePos = -1;
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === typeName) {
        nodePos = p;
        return false;
      }
      return true;
    });
    const tr = editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, nodePos + 1),
    );
    editor.view.dispatch(tr);
  }

  it("代码块内输入 / 不触发（parent 不是 paragraph）", () => {
    const editor = makeEditor("<pre><code>// code</code></pre>");
    setCursorInside(editor, "codeBlock");
    expect(editor.state.selection.$anchor.parent.type.name).toBe("codeBlock");
    editor.commands.insertContent("/");
    expect(getSlashCommandState(editor).active).toBe(false);
    editor.destroy();
  });

  it("标题内输入 / 不触发（parent 不是 paragraph）", () => {
    const editor = makeEditor("<h2>标题</h2>");
    setCursorInside(editor, "heading");
    expect(editor.state.selection.$anchor.parent.type.name).toBe("heading");
    editor.commands.insertContent("/");
    expect(getSlashCommandState(editor).active).toBe(false);
    editor.destroy();
  });
});

describe("getSlashCommandState — 嵌套容器", () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  it("blockquote 内的段落可触发", () => {
    editor = makeEditor("<blockquote><p></p></blockquote>");
    editor.commands.focus();
    typeSlash(editor, "quote");
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(true);
    expect(s.query).toBe("quote");
  });

  it("callout 内的段落可触发", () => {
    editor = makeEditor();
    editor.chain().focus().setCallout().run();
    editor.commands.focus();
    typeSlash(editor, "call");
    expect(getSlashCommandState(editor).active).toBe(true);
  });

  it("columns 列内的段落可触发", () => {
    editor = makeEditor();
    editor.chain().focus().setColumns().run();
    editor.commands.focus();
    typeSlash(editor);
    expect(getSlashCommandState(editor).active).toBe(true);
  });

  it("列表项内的段落可触发", () => {
    editor = makeEditor("<ul><li><p>item</p></li></ul>");
    editor.commands.focus("end");
    typeSlash(editor);
    const s = getSlashCommandState(editor);
    expect(s.active).toBe(true);
  });

  it("details 折叠块内的段落可触发", () => {
    editor = makeEditor();
    editor.chain().focus().setDetails().run();
    editor.commands.focus();
    typeSlash(editor);
    expect(getSlashCommandState(editor).active).toBe(true);
  });
});

describe("replaceSlashWithEmpty", () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  it("删除 /query 文本后段落为空，且 NodeSelection 选中该空段落", () => {
    editor = makeEditor();
    typeSlash(editor, "heading");
    replaceSlashWithEmpty(editor);
    const sel = editor.state.selection;
    expect(sel.node?.type.name).toBe("paragraph");
    expect(sel.node?.textContent).toBe("");
  });

  it("非 active 状态下调用无副作用", () => {
    editor = makeEditor("<p>普通文本</p>");
    const htmlBefore = editor.getHTML();
    replaceSlashWithEmpty(editor);
    expect(editor.getHTML()).toBe(htmlBefore);
  });

  it("删除后选区为 NodeSelection，便于后续 insertContent 替换整块", () => {
    editor = makeEditor();
    typeSlash(editor, "table");
    replaceSlashWithEmpty(editor);
    const sel = editor.state.selection;
    expect(sel.$anchor.parent.type.name === "paragraph" || sel.node != null).toBe(true);
  });
});

describe("filterInsertActions — 完整过滤逻辑", () => {
  let editor: Editor;
  let actions: ReturnType<typeof getInsertActions>;

  beforeEach(() => {
    editor = makeEditor();
    actions = getInsertActions({ editor, t });
  });
  afterEach(() => editor.destroy());

  it("空字符串/全空格返回全部", () => {
    expect(filterInsertActions(actions, "")).toHaveLength(actions.length);
    expect(filterInsertActions(actions, "   ")).toHaveLength(actions.length);
  });

  it("英文标签前缀/包含匹配", () => {
    expect(filterInsertActions(actions, "heading").some((a) => a.id === "heading-1")).toBe(true);
    expect(filterInsertActions(actions, "table").some((a) => a.id === "table")).toBe(true);
  });

  it("中文单字走前缀匹配（label 以该字开头）", () => {
    const result = filterInsertActions(actions, "标");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.label.startsWith("标"))).toBe(true);
  });

  it("中文多字走包含匹配", () => {
    const result = filterInsertActions(actions, "标题");
    expect(result.some((a) => a.id === "heading-1")).toBe(true);
  });

  it("别名（aliases）匹配", () => {
    expect(filterInsertActions(actions, "h1").some((a) => a.id === "heading-1")).toBe(true);
    expect(filterInsertActions(actions, "todo").some((a) => a.id === "taskList")).toBe(true);
    expect(filterInsertActions(actions, "quote").some((a) => a.id === "blockquote")).toBe(true);
  });

  it("大小写不敏感", () => {
    expect(filterInsertActions(actions, "HEADING").length).toBeGreaterThan(0);
    expect(filterInsertActions(actions, "Table").some((a) => a.id === "table")).toBe(true);
  });

  it("无匹配返回空数组", () => {
    expect(filterInsertActions(actions, "zzzz_not_exist")).toHaveLength(0);
  });

  it("每个 action 都有合法字段", () => {
    for (const a of actions) {
      expect(a.id).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(typeof a.run).toBe("function");
      expect(["basic", "structure", "media"]).toContain(a.group);
    }
  });

  it("表格命令在表格内 available=false", () => {
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    const tableAction = getInsertActions({ editor }).find((a) => a.id === "table");
    expect(tableAction?.available).toBe(false);
  });

  it("表格命令在表格外 available=true", () => {
    const tableAction = actions.find((a) => a.id === "table");
    expect(tableAction?.available).toBe(true);
  });
});

describe("getInsertActions — 命令执行", () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  function runAction(id: string) {
    const actions = getInsertActions({ editor: editor!, clearSlashQuery: true });
    const action = actions.find((a) => a.id === id);
    expect(action, `action ${id} 应存在`).toBeTruthy();
    action!.run();
  }

  it("heading-1 插入一级标题", () => {
    editor = makeEditor();
    runAction("heading-1");
    expect(editor.isActive("heading", { level: 1 })).toBe(true);
  });

  it("paragraph 切换为普通段落", () => {
    editor = makeEditor();
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    runAction("paragraph");
    expect(editor.isActive("paragraph")).toBe(true);
  });

  it("bulletList 切换无序列表", () => {
    editor = makeEditor();
    runAction("bulletList");
    expect(editor.isActive("bulletList")).toBe(true);
  });

  it("orderedList 切换有序列表", () => {
    editor = makeEditor();
    runAction("orderedList");
    expect(editor.isActive("orderedList")).toBe(true);
  });

  it("blockquote 切换引用", () => {
    editor = makeEditor();
    runAction("blockquote");
    expect(editor.isActive("blockquote")).toBe(true);
  });

  it("codeBlock 切换代码块", () => {
    editor = makeEditor();
    runAction("codeBlock");
    expect(editor.isActive("codeBlock")).toBe(true);
  });

  it("table 插入 3x3 表格", () => {
    editor = makeEditor();
    runAction("table");
    expect(editor.isActive("table")).toBe(true);
  });

  it("callout 插入提示框", () => {
    editor = makeEditor();
    runAction("callout");
    expect(editor.isActive("callout")).toBe(true);
  });

  it("columns 插入分栏", () => {
    editor = makeEditor();
    runAction("columns");
    let count = 0;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "columns") count++;
      return true;
    });
    expect(count).toBe(1);
  });

  it("details 插入折叠块", () => {
    editor = makeEditor();
    runAction("details");
    expect(editor.isActive("details")).toBe(true);
  });

  it("attachment 插入附件节点", () => {
    editor = makeEditor();
    runAction("attachment");
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "attachment") found = true;
      return true;
    });
    expect(found).toBe(true);
  });

  it("katex 插入公式节点", () => {
    editor = makeEditor();
    runAction("katex");
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "katex") found = true;
      return true;
    });
    expect(found).toBe(true);
  });

  it("iframe 插入嵌入节点", () => {
    editor = makeEditor();
    runAction("iframe");
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "iframe") found = true;
      return true;
    });
    expect(found).toBe(true);
  });

  it("toc 插入目录节点", () => {
    editor = makeEditor();
    runAction("toc");
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "tableOfContentsNode") found = true;
      return true;
    });
    expect(found).toBe(true);
  });

  it("taskList 切换任务列表", () => {
    editor = makeEditor();
    runAction("taskList");
    expect(editor.isActive("taskList")).toBe(true);
  });
});
