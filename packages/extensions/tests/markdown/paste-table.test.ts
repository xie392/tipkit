import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions, UniqueID } from "../../src";

/** 回归：表格块后插入的内容不能再嵌进表格单元格。
 * 此前逐块插入跟随光标，插入表格后光标停在单元格内，后续内容全进了表格 */
function buildDemoEditor() {
  return new Editor({
    extensions: [...createBasicExtensions(), UniqueID, ...createAdvancedExtensions()],
    content: "<p></p>",
  });
}

const TABLE_AND_AFTER = `## 前置标题

| 类别 | 能力 |
| --- | --- |
| 基础 | 标题、列表 |
| 块级 | 表格、代码块 |

表格之后的一段正文。

## 后置标题
`;

describe("markdown paste table", () => {
  it("表格后的段落与标题保持在表格外部", () => {
    const editor = buildDemoEditor();
    const manager = (editor as unknown as { markdown?: { parse: (md: string) => { type?: string; content?: unknown[] } } }).markdown!;
    const tableNode = editor.schema.nodes.table;

    let insertPos = editor.state.selection.from;
    for (const seg of TABLE_AND_AFTER.split(/\n{2,}/)) {
      const parsed = manager.parse(seg);
      const content = parsed.type === "doc" && Array.isArray(parsed.content) ? parsed.content : [];
      const sizeBefore = editor.state.doc.content.size;
      editor.commands.insertContentAt(insertPos, content as never);
      insertPos += editor.state.doc.content.size - sizeBefore;
    }

    // 文档顶层直接包含 table / paragraph / heading，且段落不在 table 里
    let tableCount = 0;
    let sawTrailingParagraph = false;
    let sawTrailingHeading = false;
    editor.state.doc.forEach((node) => {
      if (node.type === tableNode) {
        tableCount++;
        return;
      }
      if (tableCount > 0) {
        if (node.type.name === "paragraph" && node.textContent.includes("表格之后")) sawTrailingParagraph = true;
        if (node.type.name === "heading") sawTrailingHeading = true;
      }
    });
    expect(tableCount).toBe(1);
    expect(sawTrailingParagraph).toBe(true);
    expect(sawTrailingHeading).toBe(true);
  });
});
