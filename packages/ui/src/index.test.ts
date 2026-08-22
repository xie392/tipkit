import { describe, expect, it } from "vitest";

describe("@tipkit/ui 冒烟", () => {
  it("包入口可加载", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
  });
});
