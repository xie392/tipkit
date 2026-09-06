import { describe, expect, it } from "vitest";
import { splitMarkdownSegments } from "../../src/markdown/paste";

/** Markdown 粘贴按顶层块切分：每块独立解析，失败块单独兜底 */
describe("splitMarkdownSegments", () => {
  it("按空行切分段落，标题/列表/段落各自成块", () => {
    const md = "## 标题\n\n- 项目一\n- 项目二\n\n普通段落";
    expect(splitMarkdownSegments(md)).toEqual(["## 标题", "- 项目一\n- 项目二", "普通段落"]);
  });

  it("代码围栏整体成块，内部空行与列表语法不切分", () => {
    const md = '```typescript\nimport "a";\n\n- 不是列表\n```\n\n后文';
    expect(splitMarkdownSegments(md)).toEqual(['```typescript\nimport "a";\n\n- 不是列表\n```', "后文"]);
  });

  it("列表及其缩进续行保持成块", () => {
    const md = "- 第一项\n  续行内容\n- 第二项\n\n段落";
    expect(splitMarkdownSegments(md)).toEqual(["- 第一项\n  续行内容\n- 第二项", "段落"]);
  });

  it("有序列表与引用、表格各自成块", () => {
    const md = "1. 有序项\n> 引用一行\n> 引用两行\n| a | b |\n| --- | --- |";
    expect(splitMarkdownSegments(md)).toEqual([
      "1. 有序项",
      "> 引用一行\n> 引用两行",
      "| a | b |\n| --- | --- |",
    ]);
  });

  it("单行自闭合围栏成块", () => {
    expect(splitMarkdownSegments("前段\n`code`\n后段")).toEqual(["前段\n`code`\n后段"]);
    expect(splitMarkdownSegments("``code``")).toEqual(["``code``"]);
  });

  it("空输入返回空数组", () => {
    expect(splitMarkdownSegments("")).toEqual([]);
    expect(splitMarkdownSegments("\n\n")).toEqual([]);
  });
});
