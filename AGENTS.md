# TipKit 项目规则

TipKit 是基于 Tiptap v3 + shadcn/ui 的无头富文本编辑器套件，供多个项目（blog / devkb）共用，**风格由消费方项目决定**。

## 技术栈

- pnpm + turbo monorepo：`apps/demo`（Next.js 16 App Router）+ `packages/*`
- Tiptap **v3.30**（`@tiptap/react`、`@tiptap/core`、`@tiptap/markdown`）+ ProseMirror
- React 19 + TypeScript（strict）
- Tailwind v4 + CSS 变量（主题系统）
- shadcn/ui 组件风格（`packages/components`，Radix + cva）
- 测试：vitest + happy-dom（仅逻辑层）

## 架构分层（必须遵守）

| 包 | 职责 | 样式约束 |
|---|---|---|
| `@tipkit/core` | 编辑器 hook、序列化、依赖注入（EditorDeps）、共享类型 | **零样式** |
| `@tipkit/extensions` | 全部 Tiptap 扩展 | 只加语义类名 `tk-*` + 少量可覆盖默认样式 |
| `@tipkit/ui` | 交互原语：浮层定位、键盘导航、激活态 | **仅布局**（flex/gap/z-index），禁止颜色/字体/阴影 |
| `@tipkit/components` | shadcn 基础组件 | 颜色一律走 CSS 变量 |
| `@tipkit/themes` | 主题皮肤（devkb.css / blog.css） | **一切视觉在此层** |
| `@tipkit/editor` | 聚合入口 `<TipKitEditor>` | — |

**铁律**：
- core / extensions / ui 中**禁止**出现颜色、字体、阴影、边框等视觉样式（`sketch-*`、`graph-paper` 等一律进 themes）
- 扩展禁止调用项目 API / 全局变量，一律 `useEditorDeps()` 注入
- 视觉相关代码只允许出现在 `themes/`（或 `components/` 的 shadcn 组件内）

## 编码规范

- 每个 `.ts` / `.tsx` 文件最多 **500 行**，超出必须拆分
- 变量/函数 camelCase；常量 UPPER_SNAKE_CASE；组件/类型 PascalCase；文件名 kebab-case
- 组件优先 Server Component；交互组件标 `"use client"`（编辑器全部 client）
- 扩展目录**自包含**（内部相对导入），可整体裁剪
- 修改样式/组件后运行 `pnpm type-check` 与 `pnpm build` 验证

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动 demo（turbo dev）
pnpm --filter @tipkit/demo dev   # 只启动 demo
pnpm type-check       # 全仓类型检查
pnpm test             # 全仓测试
pnpm build            # 全仓构建
```

## 文档

- `docs/PRD.md` —— 产品需求（功能清单、里程碑）
- `docs/ARCHITECTURE.md` —— 架构设计（分层、主题机制、数据流）
- `docs/TECHNICAL-DESIGN.md` —— 技术设计（接口契约、迁移计划、测试策略）
