import { describe, expect, it } from "vitest";

describe("@tipkit/ui 冒烟", () => {
  // turbo 并行下入口连带加载 @tipkit/extensions（katex 等重依赖），放宽超时
  it("包入口可加载", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeDefined();
  }, 20000);
});
