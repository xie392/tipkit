import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AiGeneration, aiKey } from "../../src/ai/ai-generation";
import type { AIProvider } from "@tipkit/core";

function makeProvider(chunks: string[], delay = 0): AIProvider {
  return {
    async *streamText(req) {
      for (const c of chunks) {
        if (req.signal?.aborted) return;
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (req.signal?.aborted) return;
        yield c;
      }
    },
  };
}

function makeEditor(provider: AIProvider, content = "<p>hello</p>") {
  return new Editor({
    extensions: [StarterKit, AiGeneration.configure({ provider, flushInterval: 0 })],
    content,
  });
}

function aiState(editor: Editor): { generating: boolean; from: number | null; to: number | null } {
  return aiKey.getState(editor.state) as never;
}

async function settle(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

describe("AI 生成命令层", () => {
  it("aiRun 在光标处流式插入内容，结束后 generating=false", async () => {
    const editor = makeEditor(makeProvider(["你", "好", "！"]));
    editor.commands.setTextSelection({ from: 6, to: 6 });
    expect(editor.commands.aiRun({ instruction: "写一句" })).toBe(true);
    await settle(30);
    const html = editor.getHTML();
    expect(html).toContain("你好！");
    const st = aiState(editor);
    expect(st.generating).toBe(false);
    expect(st.from).not.toBeNull();
    editor.destroy();
  });

  it("aiAccept 保留生成内容并清除预览状态", async () => {
    const editor = makeEditor(makeProvider(["ABC"]));
    editor.commands.setTextSelection({ from: 6, to: 6 });
    editor.commands.aiRun({ instruction: "x" });
    await settle(20);
    expect(editor.commands.aiAccept()).toBe(true);
    const st = aiState(editor);
    expect(st.from).toBeNull();
    expect(editor.getHTML()).toContain("ABC");
    editor.destroy();
  });

  it("aiDiscard 删除生成内容", async () => {
    const editor = makeEditor(makeProvider(["TO_DELETE"]));
    editor.commands.setTextSelection({ from: 6, to: 6 });
    editor.commands.aiRun({ instruction: "x" });
    await settle(20);
    expect(editor.commands.aiDiscard()).toBe(true);
    expect(editor.getHTML()).not.toContain("TO_DELETE");
    expect(aiState(editor).from).toBeNull();
    editor.destroy();
  });

  it("replace 模式替换选区文本", async () => {
    const editor = makeEditor(makeProvider(["NEW_TEXT"]));
    editor.commands.setTextSelection({ from: 1, to: 6 }); // "hello"
    expect(editor.commands.aiRun({ instruction: "改写", mode: "replace" })).toBe(true);
    await settle(20);
    const html = editor.getHTML();
    expect(html).toContain("NEW_TEXT");
    expect(html).not.toContain("hello");
    editor.destroy();
  });

  it("provider 注入的 selection 与 prompt 正确", async () => {
    let captured: { prompt?: string; selection?: string } = {};
    const provider: AIProvider = {
      async *streamText(req) {
        captured = { prompt: req.prompt, selection: req.selection };
        yield "ok";
      },
    };
    const editor = makeEditor(provider);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.aiRun({ instruction: "改写这句话", mode: "replace" });
    await settle(20);
    expect(captured.prompt).toBe("改写这句话");
    expect(captured.selection).toBe("hello");
    editor.destroy();
  });

  it("aiCancel 中断流，已生成内容保留且进入可接受状态", async () => {
    const editor = makeEditor(makeProvider(["A", "B", "C", "D"], 10));
    editor.commands.setTextSelection({ from: 6, to: 6 });
    editor.commands.aiRun({ instruction: "x" });
    await settle(25); // 至少收到一个 chunk
    expect(editor.commands.aiCancel()).toBe(true);
    await settle(30);
    const st = aiState(editor);
    expect(st.generating).toBe(false);
    expect(st.from).not.toBeNull();
    expect(editor.getHTML().length).toBeGreaterThan("<p>hello</p>".length);
    editor.destroy();
  });

  it("未配置 provider 时 aiRun 返回 false", () => {
    const editor = new Editor({
      extensions: [StarterKit, AiGeneration],
      content: "<p>x</p>",
    });
    expect(editor.commands.aiRun({ instruction: "x" })).toBe(false);
    editor.destroy();
  });

  it("生成中重复 aiRun 被拒绝", async () => {
    const editor = makeEditor(makeProvider(["A", "B"], 15));
    editor.commands.setTextSelection({ from: 6, to: 6 });
    editor.commands.aiRun({ instruction: "x" });
    expect(editor.commands.aiRun({ instruction: "y" })).toBe(false);
    await settle(60);
    editor.destroy();
  });
});
