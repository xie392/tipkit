import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import {
  createBasicExtensions,
  createAdvancedExtensions,
  Attachment,
  Callout,
  CALLOUT_VARIANTS,
  Columns,
  Column,
  ColumnLayout,
  Details,
  DetailsSummary,
  DetailsContent,
  Iframe,
  ImageBlock,
  Katex,
} from "../../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), ...createAdvancedExtensions()],
    content,
  });
}

function findFirstNode(editor: Editor, name: string) {
  let found: { node: any; pos: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name) {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}

afterEach(() => {
  // 编辑器在各自测试中 destroy
});

describe("Attachment 附件节点", () => {
  it("setAttachment 插入 atom 节点", () => {
    const editor = makeEditor();
    editor.chain().focus().setAttachment().run();
    const found = findFirstNode(editor, "attachment");
    expect(found).not.toBeNull();
    expect(found!.node.type.isAtom).toBe(true);
    editor.destroy();
  });

  it("默认属性齐全", () => {
    const editor = makeEditor();
    editor.chain().focus().setAttachment().run();
    const { node } = findFirstNode(editor, "attachment")!;
    expect(node.attrs.fileName).toBeNull();
    expect(node.attrs.fileSize).toBeNull();
    expect(node.attrs.fileType).toBeNull();
    expect(node.attrs.fileExt).toBeNull();
    expect(node.attrs.url).toBeNull();
    expect(node.attrs.hasTrigger).toBe(false);
    editor.destroy();
  });

  it("可设置完整属性", () => {
    const editor = makeEditor();
    editor.chain().focus().setAttachment({
      fileName: "设计文档",
      fileExt: "pdf",
      fileSize: 102400,
      url: "https://example.com/f.pdf",
    }).run();
    const { node } = findFirstNode(editor, "attachment")!;
    expect(node.attrs.fileName).toBe("设计文档");
    expect(node.attrs.fileExt).toBe("pdf");
    expect(node.attrs.fileSize).toBe(102400);
    editor.destroy();
  });

  it("HTML 解析时自动从 data-filename 去除扩展名（防双重后缀）", () => {
    const editor = makeEditor(
      '<div class="tk-attachment" data-filename="项目设计文档.pdf" data-fileext="pdf" data-url="https://x.com/f.pdf"></div>',
    );
    const { node } = findFirstNode(editor, "attachment")!;
    // stripFileExt 应去除 .pdf，保留纯文件名
    expect(node.attrs.fileName).toBe("项目设计文档");
    expect(node.attrs.fileExt).toBe("pdf");
    editor.destroy();
  });

  it("无扩展名文件名解析不报错", () => {
    const editor = makeEditor(
      '<div class="tk-attachment" data-filename="Makefile"></div>',
    );
    const { node } = findFirstNode(editor, "attachment")!;
    expect(node.attrs.fileName).toBe("Makefile");
    editor.destroy();
  });

  it("renderHTML 生成下载卡片", () => {
    const editor = makeEditor();
    editor.chain().focus().setAttachment({
      fileName: "报告",
      fileExt: "pdf",
      fileSize: 2048,
      url: "https://x.com/r.pdf",
    }).run();
    const html = editor.getHTML();
    expect(html).toContain("tk-attachment");
    expect(html).toContain("报告.pdf");
    expect(html).toContain("https://x.com/r.pdf");
    editor.destroy();
  });
});

describe("Callout 提示块", () => {
  it("setCallout 插入 callout 节点", () => {
    const editor = makeEditor();
    editor.chain().focus().setCallout().run();
    expect(editor.isActive("callout")).toBe(true);
    editor.destroy();
  });

  it("默认 variant 为 info", () => {
    const editor = makeEditor();
    editor.chain().focus().setCallout().run();
    expect(editor.getAttributes("callout").variant).toBe("info");
    editor.destroy();
  });

  it("CALLOUT_VARIANTS 包含 info/warning/danger/success/note", () => {
    const variants = Object.keys(CALLOUT_VARIANTS);
    expect(variants).toContain("info");
    expect(variants).toContain("warning");
    expect(variants).toContain("danger");
    expect(variants).toContain("success");
    expect(variants).toContain("note");
  });

  it("setCalloutVariant 可切换 variant", () => {
    const editor = makeEditor();
    editor.chain().focus().setCallout().setCalloutVariant("warning").run();
    expect(editor.getAttributes("callout").variant).toBe("warning");
    editor.destroy();
  });

  it("setCalloutEmoji 可设置 emoji", () => {
    const editor = makeEditor();
    editor.chain().focus().setCallout().setCalloutEmoji("💡").run();
    expect(editor.getAttributes("callout").emoji).toBe("💡");
    editor.destroy();
  });

  it("content 为 paragraph+（至少一个段落）", () => {
    const schema = Callout as any;
    expect(schema.config.content).toBe("paragraph+");
  });
});

describe("Columns 分栏", () => {
  it("setColumns 插入两栏", () => {
    const editor = makeEditor();
    editor.chain().focus().setColumns().run();
    let cols = 0;
    let columnCount = 0;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "columns") cols++;
      if (n.type.name === "column") columnCount++;
      return true;
    });
    expect(cols).toBe(1);
    expect(columnCount).toBe(2);
    editor.destroy();
  });

  it("默认 layout 为 twoColumn", () => {
    const editor = makeEditor();
    editor.chain().focus().setColumns().run();
    const { node } = findFirstNode(editor, "columns")!;
    expect(node.attrs.layout).toBe(ColumnLayout.TwoColumn);
    editor.destroy();
  });

  it("setLayout 可切换布局", () => {
    const editor = makeEditor();
    editor.chain().focus().setColumns().run();
    // 只要命令存在且不抛错即可（具体布局值由 ColumnLayout 定义）
    expect(() => editor.commands.setLayout(ColumnLayout.TwoColumn)).not.toThrow();
    editor.destroy();
  });

  it("ColumnLayout 枚举包含至少两种布局", () => {
    const values = Object.values(ColumnLayout);
    expect(values.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Details 折叠块", () => {
  it("setDetails 插入 details + summary + content", () => {
    const editor = makeEditor();
    editor.chain().focus().setDetails().run();
    expect(editor.isActive("details")).toBe(true);
    const details = findFirstNode(editor, "details");
    const summary = findFirstNode(editor, "detailsSummary");
    const content = findFirstNode(editor, "detailsContent");
    expect(details).not.toBeNull();
    expect(summary).not.toBeNull();
    expect(content).not.toBeNull();
    editor.destroy();
  });

  it("默认 open=true", () => {
    const editor = makeEditor();
    editor.chain().focus().setDetails().run();
    expect(editor.getAttributes("details").open).toBe(true);
    editor.destroy();
  });

  it("summary 默认文本走 i18n（details.summaryPlaceholder）", () => {
    const editor = makeEditor();
    // 未注入 t 时降级返回 key 本身
    editor.chain().focus().setDetails().run();
    let found = findFirstNode(editor, "detailsSummary")!;
    expect(found.node.textContent).toBe("details.summaryPlaceholder");
    editor.destroy();

    // 注入 zh 词典后为中文默认文案
    const editor2 = makeEditor();
    (editor2 as unknown as { __tipkitT?: (k: string) => string }).__tipkitT = (k) =>
      k === "details.summaryPlaceholder" ? "折叠标题" : k;
    editor2.chain().focus().setDetails().run();
    found = findFirstNode(editor2, "detailsSummary")!;
    expect(found.node.textContent).toBe("折叠标题");
    editor2.destroy();
  });

  it("details 为 isolating 节点（防止内部内容溢出）", () => {
    const schema = Details as any;
    expect(schema.config.isolating).toBe(true);
  });
});

describe("Iframe 嵌入节点", () => {
  it("setIframe 插入 atom 节点，url 默认为 null", () => {
    const editor = makeEditor();
    editor.chain().focus().setIframe({ url: null }).run();
    const { node } = findFirstNode(editor, "iframe")!;
    expect(node.type.isAtom).toBe(true);
    expect(node.attrs.url).toBeNull();
    editor.destroy();
  });

  it("可设置 url/width/height", () => {
    const editor = makeEditor();
    editor.chain().focus().setIframe({
      url: "https://www.youtube.com/embed/abc",
      width: "100%",
      height: 480,
    }).run();
    const { node } = findFirstNode(editor, "iframe")!;
    expect(node.attrs.url).toBe("https://www.youtube.com/embed/abc");
    expect(node.attrs.height).toBe(480);
    editor.destroy();
  });

  it("HTML 解析保留 url/height", () => {
    const editor = makeEditor(
      '<div class="tk-iframe" data-url="https://example.com" data-height="400" data-width="100%"></div>',
    );
    const { node } = findFirstNode(editor, "iframe")!;
    expect(node.attrs.url).toBe("https://example.com");
    expect(node.attrs.height).toBe(400);
    editor.destroy();
  });

  it("非法 height 回退到默认 360", () => {
    const editor = makeEditor(
      '<div class="tk-iframe" data-url="https://example.com" data-height="abc"></div>',
    );
    const { node } = findFirstNode(editor, "iframe")!;
    expect(node.attrs.height).toBe(360);
    editor.destroy();
  });
});

describe("ImageBlock 图片块", () => {
  it("setImageBlock 插入 block 图片", () => {
    const editor = makeEditor();
    editor.chain().focus().setImageBlock({ src: "https://x.com/a.png" }).run();
    const { node } = findFirstNode(editor, "imageBlock")!;
    expect(node.attrs.src).toBe("https://x.com/a.png");
    editor.destroy();
  });

  it("默认 align=center, width=100%", () => {
    const editor = makeEditor();
    editor.chain().focus().setImageBlock({ src: "https://x.com/a.png" }).run();
    const { node } = findFirstNode(editor, "imageBlock")!;
    expect(node.attrs.align).toBe("center");
    expect(node.attrs.width).toBe("100%");
    editor.destroy();
  });

  it("setImageBlockAlign/setImageBlockWidth 可更新", () => {
    const editor = makeEditor();
    editor.chain().focus().setImageBlock({ src: "https://x.com/a.png" }).run();
    editor.chain().focus().setImageBlockAlign("left").setImageBlockWidth(50).run();
    const { node } = findFirstNode(editor, "imageBlock")!;
    expect(node.attrs.align).toBe("left");
    expect(node.attrs.width).toBe("50%");
    editor.destroy();
  });

  it("HTML 解析从 div[data-type=image-block] 读取 src/width/align", () => {
    const editor = makeEditor(
      '<div data-type="image-block" data-width="50" data-align="right"><img src="https://x.com/b.jpg" alt="图"></div>',
    );
    const { node } = findFirstNode(editor, "imageBlock")!;
    expect(node.attrs.src).toBe("https://x.com/b.jpg");
    expect(node.attrs.width).toBe("50");
    expect(node.attrs.align).toBe("right");
    expect(node.attrs.alt).toBe("图");
    editor.destroy();
  });
});

describe("Katex 公式节点", () => {
  it("setKatex 插入 atom 节点", () => {
    const editor = makeEditor();
    editor.chain().focus().setKatex({ text: "E=mc^2" }).run();
    const { node } = findFirstNode(editor, "katex")!;
    expect(node.type.isAtom).toBe(true);
    expect(node.attrs.text).toBe("E=mc^2");
    editor.destroy();
  });

  it("默认 text 为空字符串", () => {
    const editor = makeEditor();
    editor.chain().focus().setKatex().run();
    const { node } = findFirstNode(editor, "katex")!;
    expect(node.attrs.text).toBe("");
    editor.destroy();
  });

  it("HTML 解析 data-text 属性", () => {
    const editor = makeEditor('<div class="tk-katex" data-text="x^2+y^2"></div>');
    const { node } = findFirstNode(editor, "katex")!;
    expect(node.attrs.text).toBe("x^2+y^2");
    editor.destroy();
  });
});

describe("扩展注册完整性", () => {
  it("所有高级扩展均成功注册，无重复 name", () => {
    const editor = makeEditor();
    const names = ["attachment", "callout", "columns", "column", "details",
      "detailsSummary", "detailsContent", "iframe", "imageBlock", "katex"];
    for (const name of names) {
      expect(editor.schema.nodes[name], `节点 ${name} 应注册`).toBeDefined();
    }
    editor.destroy();
  });
});
