# TipKit 项目规则（Comate）

## 核心架构约束

- **无头编辑器**：core/extensions/ui 禁止视觉样式（颜色/字体/阴影/边框），一切视觉在 `packages/themes`
- 扩展只加语义类名 `tk-*`，禁止项目特定类名（如 blog 的 `sketch-*`）
- 项目特定能力（上传/存储/katex 渲染）必须走 `EditorDeps` 依赖注入
- 包依赖方向：`editor → {core, extensions, ui}`，`extensions/ui → core`，禁止反向

## 技术栈

Tiptap v3 + React 19 + TypeScript strict + Tailwind v4 + pnpm/turbo monorepo + vitest

## 编码规范

- 单文件 ≤ 500 行，超出拆分
- 命名：camelCase / UPPER_SNAKE_CASE / PascalCase / kebab-case 文件名
- 编辑器组件全部 `"use client"`，SSR 场景 `immediatelyRender: false`

## 验证命令

```bash
pnpm type-check && pnpm build
```
