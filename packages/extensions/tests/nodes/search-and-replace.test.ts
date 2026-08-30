import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createBasicExtensions, SearchAndReplace, searchAndReplaceKey } from "../../src/index";

function makeEditor(content?: string) {
  return new Editor({
    extensions: [...createBasicExtensions(), SearchAndReplace],
    content,
  });
}

function getSearchState(editor: Editor) {
  return searchAndReplaceKey.getState(editor.state)!;
}

function findDecorations(editor: Editor) {
  const decoSet = searchAndReplaceKey.getState(editor.state);
  void decoSet;
  // 直接从插件读取装饰
  const plugin = editor.state.plugins.find((p) => (p as any).key.includes("searchAndReplace"));
  const props = plugin?.props.decorations;
  if (!props) return [];
  const set = props(editor.state, editor.state.tr) as any;
  const out: { from: number; to: number; class: string }[] = [];
  set?.find?.().forEach((d: any) => out.push({ from: d.from, to: d.to, class: d.type.attrs.class }));
  return out;
}

describe("SearchAndReplace 查找替换", () => {
  it("setSearchTerm 计算全部匹配并产生高亮装饰", () => {
    const editor = makeEditor("<p>foo bar foo</p>");
    editor.commands.setSearchTerm("foo");
    const s = getSearchState(editor);
    expect(s.matches).toHaveLength(2);
    expect(s.activeIndex).toBe(0);
    const decos = findDecorations(editor);
    expect(decos).toHaveLength(2);
    expect(decos[0].class).toContain("tk-search-match");
    editor.destroy();
  });

  it("caseSensitive 控制大小写敏感", () => {
    const editor = makeEditor("<p>Foo foo FOO</p>");
    editor.commands.setSearchTerm("foo", { caseSensitive: true });
    expect(getSearchState(editor).matches).toHaveLength(1);
    editor.commands.setSearchTerm("foo", { caseSensitive: false });
    expect(getSearchState(editor).matches).toHaveLength(3);
    editor.destroy();
  });

  it("正则元字符按字面量处理", () => {
    const editor = makeEditor("<p>a.b axb</p>");
    editor.commands.setSearchTerm("a.b");
    expect(getSearchState(editor).matches).toHaveLength(1);
    editor.destroy();
  });

  it("nextSearchMatch 循环跳转并选中匹配", () => {
    const editor = makeEditor("<p>aa</p>");
    editor.commands.setSearchTerm("a");
    editor.commands.nextSearchMatch();
    expect(getSearchState(editor).activeIndex).toBe(1);
    editor.commands.nextSearchMatch();
    expect(getSearchState(editor).activeIndex).toBe(0);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("a");
    editor.destroy();
  });

  it("previousSearchMatch 从 0 回绕到最后一个", () => {
    const editor = makeEditor("<p>aaa</p>");
    editor.commands.setSearchTerm("a");
    editor.commands.previousSearchMatch();
    expect(getSearchState(editor).activeIndex).toBe(2);
    editor.destroy();
  });

  it("replaceSearchMatch 只替换当前激活项", () => {
    const editor = makeEditor("<p>cat cat</p>");
    editor.commands.setSearchTerm("cat");
    editor.commands.replaceSearchMatch("dog");
    expect(editor.state.doc.textContent).toBe("dog cat");
    // 文档变化后匹配被重算
    expect(getSearchState(editor).matches).toHaveLength(1);
    editor.destroy();
  });

  it("replaceAllSearchMatches 替换全部", () => {
    const editor = makeEditor("<p>cat cat cat</p>");
    editor.commands.setSearchTerm("cat");
    editor.commands.replaceAllSearchMatches("dog");
    expect(editor.state.doc.textContent).toBe("dog dog dog");
    editor.destroy();
  });

  it("clearSearch 清空状态与装饰", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.setSearchTerm("a");
    editor.commands.clearSearch();
    const s = getSearchState(editor);
    expect(s.term).toBe("");
    expect(s.matches).toHaveLength(0);
    expect(findDecorations(editor)).toHaveLength(0);
    editor.destroy();
  });
});
