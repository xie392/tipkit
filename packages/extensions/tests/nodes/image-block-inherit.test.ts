import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import {
  createBasicExtensions,
  createAdvancedExtensions,
  ImageBlock,
} from "../../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

function findNodes(editor: Editor, name: string) {
  const found: { node: any; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name) found.push({ node, pos });
    return true;
  });
  return found;
}

describe("ImageBlock 属性沿袭", () => {
  it("新插入图片沿袭文内已有图片的样式/对齐/宽度", () => {
    const editor = makeEditor(
      `<div data-type="image-block" data-image-style="shadow" data-align="left" data-width="60%"><img src="https://a.com/1.png"></div><p>text</p>`,
    );
    editor.commands.setImageBlockAt({ src: "https://a.com/2.png", pos: editor.state.doc.content.size });
    editor.destroy();

    const nodes = findNodes(editor, "imageBlock");
    expect(nodes).toHaveLength(2);
    const last = nodes[1].node.attrs;
    expect(last.imageStyle).toBe("shadow");
    expect(last.align).toBe("left");
    expect(last.width).toBe("60%");
  });

  it("文档中没有其他图片时保持默认值", () => {
    const editor = makeEditor("<p>text</p>");
    editor.commands.setImageBlock({ src: "https://a.com/1.png" });
    const [img] = findNodes(editor, "imageBlock");
    expect(img.node.attrs.imageStyle).toBe("none");
    expect(img.node.attrs.align).toBe("center");
    expect(img.node.attrs.width).toBe("100%");
    editor.destroy();
  });

  it("显式传入的属性优先于沿袭值", () => {
    const editor = makeEditor(
      `<div data-type="image-block" data-image-style="border" data-align="right" data-width="40%"><img src="https://a.com/1.png"></div>`,
    );
    editor.commands.setImageBlockAt({
      src: "https://a.com/2.png",
      pos: editor.state.doc.content.size,
      imageStyle: "none",
      align: "center",
      width: "100%",
    } as any);
    const nodes = findNodes(editor, "imageBlock");
    const last = nodes[1].node.attrs;
    expect(last.imageStyle).toBe("none");
    expect(last.align).toBe("center");
    editor.destroy();
  });
});
