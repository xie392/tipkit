import { describe, expect, it } from "vitest";

describe("@tipkit/editor 冒烟", () => {
  // turbo 并行下入口连带加载 extensions/ui 全量依赖（katex 等），放宽超时
  it("包入口可加载", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeDefined();
    expect(typeof mod.TipKitEditor).toBe("function");
  }, 20000);
});
