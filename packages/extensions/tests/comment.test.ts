import { describe, expect, it, vi, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Comment } from "../src/comment/comment";

function makeEditor(content = "<p>hello world</p>", opts?: { onCommentClick?: (id: string) => void }) {
  return new Editor({
    extensions: [
      StarterKit,
      Comment.configure({ onCommentClick: opts?.onCommentClick }),
    ],
    content,
  });
}

afterEach(() => {
  // 每个测试自己 destroy
});

describe("Comment Mark 基础能力", () => {
  it("扩展注册后 schema 中存在 comment mark", () => {
    const editor = makeEditor();
    expect(editor.schema.marks.comment).toBeDefined();
    editor.destroy();
  });

  it("setComment 在选区上添加 comment mark，生成 commentId", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    const ok = editor.chain().setComment("c_001").run();
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("data-comment-id");
    expect(html).toContain("c_001");
    expect(html).toContain("tk-comment");
    editor.destroy();
  });

  it("setComment 不传 id 时自动生成", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    const ok = editor.chain().setComment().run();
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toMatch(/data-comment-id="c_\d+_[a-z0-9]+"/);
    editor.destroy();
  });

  it("空选区 setComment 返回 false 且不应用 mark", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 1 });
    const ok = editor.chain().setComment("c_x").run();
    expect(ok).toBe(false);
    expect(editor.getHTML()).not.toContain("data-comment-id");
    editor.destroy();
  });

  it("unsetComment 移除选区上的 comment mark", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().setComment("c_rm").run();
    expect(editor.getHTML()).toContain("c_rm");

    editor.commands.setTextSelection({ from: 1, to: 6 });
    const ok = editor.chain().unsetComment().run();
    expect(ok).toBe(true);
    expect(editor.getHTML()).not.toContain("c_rm");
    editor.destroy();
  });

  it("HTML 往返解析保留 comment mark 与 id", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().setComment("c_rt").run();
    const html = editor.getHTML();
    editor.destroy();

    const editor2 = makeEditor(html);
    const html2 = editor2.getHTML();
    expect(html2).toContain("data-comment-id");
    expect(html2).toContain("c_rt");
    expect(html2).toContain("tk-comment");
    editor2.destroy();
  });

  it("renderHTML 输出 span.tk-comment 包裹", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().setComment("c_span").run();
    const html = editor.getHTML();
    expect(html).toContain('<span');
    expect(html).toContain('class="tk-comment"');
    editor.destroy();
  });

  it("isActive 可检测 comment mark 激活", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().setComment("c_act").run();
    // 光标落在已标注区域内
    editor.commands.setTextSelection({ from: 3, to: 3 });
    expect(editor.isActive("comment")).toBe(true);
    editor.destroy();
  });
});

describe("Comment 配置与 DOM 输出", () => {
  it("配置 onCommentClick 回调可被扩展接收", () => {
    const onClick = vi.fn();
    const editor = new Editor({
      extensions: [StarterKit, Comment.configure({ onCommentClick: onClick })],
      content: "<p>hello</p>",
    });
    const ext = editor.extensionManager.extensions.find((e) => e.name === "comment");
    expect(ext).toBeDefined();
    expect(ext?.options.onCommentClick).toBe(onClick);
    editor.destroy();
  });

  it("标记后的 HTML 包含 data-comment-id 与 tk-comment 类名", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().setComment("c_dom").run();
    const html = editor.getHTML();
    expect(html).toContain('data-comment-id="c_dom"');
    expect(html).toContain('class="tk-comment"');
    editor.destroy();
  });
});
