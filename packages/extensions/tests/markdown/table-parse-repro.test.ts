import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../../src/index";

const MD = `| 选项 | 默认 | 说明 |
| --- | --- | --- |
| \`types\` | paragraph | 需要携带 id 的节点类型 |
| \`generateID\` | crypto.randomUUID | 自定义 id 生成器 |

### 二级标题

正文段落
`;

function buildEditor() {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content: MD,
    // @ts-expect-error contentType 由 @tiptap/markdown 模块增强
    contentType: "markdown",
    editable: false,
  });
}

describe("markdown 表格解析", () => {
  it("表格应解析为 table 节点", () => {
    const editor = buildEditor();
    const json = editor.getJSON();
    console.log(JSON.stringify(json, null, 2).slice(0, 3000));
    const types = json.content?.map((n) => n.type);
    console.log("TOP-LEVEL:", types);
    expect(types).toContain("table");
    editor.destroy();
  });
});
