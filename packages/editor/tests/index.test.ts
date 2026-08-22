import { describe, expect, it } from "vitest";

describe("@tipkit/editor 冒烟", () => {
  it("包入口可加载", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeDefined();
    expect(typeof mod.TipKitEditor).toBe("function");
  });
});
