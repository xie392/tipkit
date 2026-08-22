import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createSerializer } from "@tipkit/core";
import { createBasicExtensions } from "@tipkit/extensions";

/** M1 核心验证：Markdown ↔ JSON 序列化往返 */
describe("createSerializer", () => {
  it("JSON → Markdown（标题/加粗/列表）", () => {
    const editor = new Editor({ extensions: createBasicExtensions() });
    const s = createSerializer(editor);

    const md = "# 标题\n\n正文 **加粗** 和 *斜体*\n\n- 项目一\n- 项目二";
    const json = s.fromMarkdown(md);
    expect(json.type).toBe("doc");

    const out = s.toMarkdown(json);
    expect(out).toContain("# 标题");
    expect(out).toContain("**加粗**");
    expect(out).toContain("- 项目一");
    editor.destroy();
  });

  it("Markdown 往返不丢内容", () => {
    const editor = new Editor({ extensions: createBasicExtensions() });
    const s = createSerializer(editor);

    const md = "> 引用\n\n1. 第一\n2. 第二\n\n`inline` 代码";
    const roundTrip = s.toMarkdown(s.fromMarkdown(md));
    expect(roundTrip).toContain("> 引用");
    expect(roundTrip).toContain("1. 第一");
    expect(roundTrip).toContain("`inline`");
    editor.destroy();
  });
});
