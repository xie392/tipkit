import { describe, expect, it } from "vitest";

// 直接复刻 marks.ts 中导出的正则（测试行内 markdown 触发条件）
const boldStarRegex = /(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
const boldUnderscoreRegex = /(__(?!\s+__)((?:[^_]+))__(?!\s+__))$/;
const italicStarRegex = /(?<!\*)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
const italicUnderscoreRegex = /(?<!_)(_(?!\s+)((?:[^_]+))_(?!\s+_))$/;
const strikeRegex = /(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;
const codeInputMatch = (text: string) => {
  const match = /`([^`]+)`(?!`)$/.exec(text);
  if (!match) return null;
  if (match.index > 0 && text[match.index - 1] === "`") return null;
  return match[1];
};

// 列表输入规则正则
const bulletListInputRegex = /^\s*([-+*])\s$/;
const orderedListInputRegex = /^(\d+)\.\s$/;

describe("行内 Markdown 正则 — 加粗", () => {
  it("**text** 匹配", () => {
    expect(boldStarRegex.exec("**hello**")?.[2]).toBe("hello");
  });
  it("__text__ 匹配", () => {
    expect(boldUnderscoreRegex.exec("__hello__")?.[2]).toBe("hello");
  });
  it("中文内容 **加粗** 匹配（光标在闭合 ** 后）", () => {
    expect(boldStarRegex.exec("这是**加粗**")?.[2]).toBe("加粗");
  });
  it("内部含空格 **a b** 匹配", () => {
    expect(boldStarRegex.exec("**a b**")?.[2]).toBe("a b");
  });
  it("空内容 **** 不匹配", () => {
    expect(boldStarRegex.exec("****")).toBeNull();
  });
  it("未闭合 **text 不匹配", () => {
    expect(boldStarRegex.exec("**text")).toBeNull();
  });
});

describe("行内 Markdown 正则 — 斜体", () => {
  it("*text* 匹配", () => {
    expect(italicStarRegex.exec("*hello*")?.[2]).toBe("hello");
  });
  it("_text_ 匹配", () => {
    expect(italicUnderscoreRegex.exec("_hello_")?.[2]).toBe("hello");
  });
  it("在 **加粗* 场景不误匹配斜体（前导 * 守卫）", () => {
    // 输入 **加粗* 时，第一个 * 前面是 *，不应匹配
    expect(italicStarRegex.exec("**加粗*")).toBeNull();
  });
});

describe("行内 Markdown 正则 — 删除线", () => {
  it("~~text~~ 匹配", () => {
    expect(strikeRegex.exec("~~deleted~~")?.[2]).toBe("deleted");
  });
  it("中文 ~~删除~~ 匹配", () => {
    expect(strikeRegex.exec("这是~~删除线~~")?.[2]).toBe("删除线");
  });
  it("未闭合 ~~text 不匹配", () => {
    expect(strikeRegex.exec("~~text")).toBeNull();
  });
});

describe("行内 Markdown 正则 — 行内代码", () => {
  it("`code` 匹配", () => {
    expect(codeInputMatch("`const x = 1`")).toBe("const x = 1");
  });
  it("三反引号 `` ` `` 不匹配（代码块场景）", () => {
    expect(codeInputMatch("```")).toBeNull();
  });
  it("前面已有反引号时不匹配（`` `code` 防重复）", () => {
    // match.index > 0 且前一字符是 `
    expect(codeInputMatch("``code`")).toBeNull();
  });
});

describe("列表输入正则", () => {
  it("- 触发无序列表", () => {
    expect(bulletListInputRegex.exec("- ")).not.toBeNull();
    expect(bulletListInputRegex.exec("* ")).not.toBeNull();
    expect(bulletListInputRegex.exec("+ ")).not.toBeNull();
  });
  it("1. 触发有序列表", () => {
    const m = orderedListInputRegex.exec("1. ");
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe("1");
  });
  it("99. 有序列表保留序号", () => {
    const m = orderedListInputRegex.exec("99. ");
    expect(m?.[1]).toBe("99");
  });
  it("纯文本 - 不带空格不触发", () => {
    expect(bulletListInputRegex.exec("-")).toBeNull();
  });
});
