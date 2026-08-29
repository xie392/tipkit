import { describe, expect, it } from "vitest";

/**
 * 扩展包冒烟测试：验证包可被导入（vitest 链路打通）。
 * 具体扩展的单元测试在迁移各扩展时逐个补充。
 */
describe("@tipkit/extensions 冒烟", () => {
  // 入口连带加载 katex / mermaid / 全量 emoji 数据等重依赖，turbo 并行下放宽超时
  it("包入口可加载", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeDefined();
  }, 30000);
});
