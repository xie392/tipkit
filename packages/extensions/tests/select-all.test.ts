import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../src/index";
import type { Node } from "@tiptap/pm/model";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

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

/** 在 doc 中找到第一个 textContent 精确匹配 text 的 textblock，返回其文本起点后 offset 位置的绝对 pos。 */
function findTextPos(doc: Node, text: string, offset = 0): number {
  let found = -1;
  (function walk(node: any, startPos: number) {
    if (found >= 0) return;
    if (node.isTextblock && node.textContent === text) {
      found = startPos + 1 + offset;
      return;
    }
    if (node.isLeaf) return;
    let childOffset = 0;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      walk(child, startPos + 1 + childOffset);
      childOffset += child.nodeSize;
    }
  })(doc, 0);
  return found;
}

describe("块级全选", () => {
  it("独立段落：首次选中该段，二次全选全文", () => {
    const editor = makeEditor("<p>第一段</p><p>第二段</p>");
    editor.commands.setTextSelection(2);
    pressModA(editor);
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      "第一段",
    );
    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("标题块：首次选中整个标题", () => {
    const editor = makeEditor("<h2>标题</h2><p>正文</p>");
    editor.commands.setTextSelection(2);
    pressModA(editor);
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      "标题",
    );
    editor.destroy();
  });

  it("代码块：首次选中整块代码，二次全选全文", () => {
    const editor = makeEditor("");
    editor.chain().focus().toggleCodeBlock().run();
    editor.commands.insertContent("line1\nline2");
    const pos = findTextPos(editor.state.doc, "line1\nline2", 2);
    editor.commands.setTextSelection(pos);

    pressModA(editor);
    const selected = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n",
    );
    expect(selected).toBe("line1\nline2");

    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("blockquote 内段落：首次选中整个 blockquote 文本", () => {
    const editor = makeEditor("<blockquote><p>引用文本</p></blockquote>");
    const pos = findTextPos(editor.state.doc, "引用文本", 2);
    editor.commands.setTextSelection(pos);
    pressModA(editor);
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      "引用文本",
    );
    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    editor.destroy();
  });

  it("callout 内多段：首次选中整个 callout 全部文本", () => {
    const editor = makeEditor("");
    editor.chain().focus().setCallout().run();
    editor.commands.insertContent("第一段");
    editor.commands.insertContent({ type: "paragraph" });
    editor.commands.insertContent("第二段");
    const pos = findTextPos(editor.state.doc, "第一段", 1);
    editor.commands.setTextSelection(pos);

    pressModA(editor);
    const selected = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n",
    );
    expect(selected).toContain("第一段");
    expect(selected).toContain("第二段");
    editor.destroy();
  });

  it("detailsContent 内列表：首次选中整个 detailsContent 文本（穿透 listItem/list）", () => {
    const html = `<details data-type="details" open="open">
      <summary data-type="summary">标题</summary>
      <div data-type="details-content">
        <ol><li><p>第一步内容</p></li><li><p>第二步内容</p></li><li><p>第三步内容</p></li></ol>
      </div>
    </details>`;
    const editor = makeEditor(html);
    const pos = findTextPos(editor.state.doc, "第一步内容", 2);
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);
    // 校验光标确实在 detailsContent 内
    {
      const $p = editor.state.selection.$from;
      let inDetailsContent = false;
      for (let d = 0; d <= $p.depth; d++) {
        if ($p.node(d).type.name === "detailsContent") inDetailsContent = true;
      }
      expect(inDetailsContent).toBe(true);
    }

    pressModA(editor);
    const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
    expect(selected).toBe("第一步内容第二步内容第三步内容");

    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("叶子块（hr）NodeSelection：直接全选全文", () => {
    const editor = makeEditor("<p>a</p><hr><p>b</p>");
    editor.commands.setTextSelection(2);
    editor.commands.selectNodeForward();
    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("空块：直接全选全文", () => {
    const editor = makeEditor("<p></p><p>第二段</p>");
    editor.commands.setTextSelection(1);
    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
    editor.destroy();
  });

  it("跨块选区：直接全选全文", () => {
    const editor = makeEditor("<p>第一段</p><p>第二段</p>");
    editor.commands.setTextSelection({ from: 1, to: 8 });
    pressModA(editor);
    expect(editor.state.selection.from).toBe(0);
    editor.destroy();
  });
});
