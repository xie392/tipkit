import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, createAdvancedExtensions } from "../../src/index";

function parse(markdown: string) {
  const editor = new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content: markdown,
    // @ts-expect-error contentType 由 @tiptap/markdown 模块增强
    contentType: "markdown",
    editable: false,
  });
  const json = editor.getJSON();
  editor.destroy();
  return json;
}

/** 展平段落，收集 [文本, 是否链接] 序列 */
function flatten(node: any): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = [];
  const walk = (n: any, href?: string) => {
    if (n.type === "text") {
      out.push({ text: n.text, href: n.marks?.find((m: any) => m.type === "link")?.attrs.href ?? href });
      return;
    }
    (n.content ?? []).forEach((c: any) => walk(c, href ?? n.marks?.find?.((m: any) => m.type === "link")?.attrs.href));
    if (n.marks) {
      // noop
    }
    void 0;
  };
  walk(node);
  return out;
}

describe("裸 URL 识别（中文边界）", () => {
  it("URL 后跟全角括号与中文正文，链接不应吞掉正文", () => {
    const json = parse("按终端提示打开地址（通常是 http://localhost:3000）、点右上角「在线演示」就能体验。");
    const para = json.content?.[0];
    const parts = flatten(para);
    const link = parts.find((p) => p.href);
    expect(link?.text).toBe("http://localhost:3000");
    expect(link?.href).toBe("http://localhost:3000");
    expect(parts.map((p) => p.text).join("")).toContain("）、点右上角");
    expect(parts.find((p) => p.text.includes("、点右上角"))?.href).toBeUndefined();
  });

  it("尾部句号应回退为正文", () => {
    const json = parse("访问 https://example.com.");
    const link = flatten(json.content?.[0]).find((p) => p.href);
    expect(link?.href).toBe("https://example.com");
  });

  it("成对括号属于 URL 一部分", () => {
    const json = parse("见 https://en.wikipedia.org/wiki/Foo_(bar) 说明");
    const link = flatten(json.content?.[0]).find((p) => p.href);
    expect(link?.href).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("www. 开头自动补 https 协议", () => {
    const json = parse("访问 www.example.com 获取详情");
    const link = flatten(json.content?.[0]).find((p) => p.href);
    expect(link?.href).toBe("https://www.example.com");
  });

  it("[文字](url) 显式链接不受影响", () => {
    const json = parse("[官网](https://example.com)）");
    const link = flatten(json.content?.[0]).find((p) => p.href);
    expect(link?.text).toBe("官网");
    expect(link?.href).toBe("https://example.com");
  });
});
