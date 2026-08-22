# TipKit 技术设计

> 版本：v0.1（骨架阶段）
> 对应架构：docs/ARCHITECTURE.md；需求：docs/PRD.md

## 1. 技术栈

| 项 | 选型 | 说明 |
|---|---|---|
| 编辑器 | Tiptap **v3.30**（`@tiptap/react`、`@tiptap/core`、`@tiptap/pm`） | 与 blog 对齐，devkb 后续从 v2 迁移 |
| 构建 | pnpm + turbo（源码直引，不构建产物） | monorepo 内部用 TS 源码 |
| 样式 | Tailwind v4 + CSS 变量 | 主题通过 CSS 文件切换 |
| UI | shadcn/ui（Radix + cva + tailwind-merge） | `@tipkit/components` |
| 测试 | vitest + happy-dom | 逻辑层测试 |
| Demo | Next.js 16 App Router | 验证 SSR |

## 2. 包依赖图

```mermaid
flowchart TB
    Editor[@tipkit/editor] --> Core
    Editor --> Ext
    Editor --> UI
    Ext --> Core
    UI --> Core
    UI --> Comp
    Theme[@tipkit/themes] -.纯 CSS.-> App
    Demo[apps/demo] --> Editor
    Demo --> Theme
```

## 3. 核心接口契约

### 3.1 `useTipKitEditor`（@tipkit/core）

```ts
function useTipKitEditor(options: {
  extensions?: Extension[];
  content?: string | Record<string, unknown>;
  placeholder?: string | string[];
  onUpdate?: (editor: Editor) => void;
  onCreate?: (editor: Editor) => void;
  onSelectionUpdate?: (editor: Editor) => void;
  immediatelyRender?: boolean;  // 默认 false（SSR 安全）
  editable?: boolean;
}): Editor | null;
```

- 内部自动装配：`StarterKit + Placeholder + options.extensions`
- **SSR 约定**：`immediatelyRender` 默认 `false`，服务端渲染安全

### 3.2 `EditorDeps`（依赖注入）

```ts
interface EditorDeps {
  uploadImage?: (file: File, editor: Editor) => Promise<string>;
  uploadAttachment?: (file: File, editor: Editor) => Promise<AttachmentMeta>;
  renderKatex?: (tex: string, displayMode: boolean) => Promise<string>;
}
```

### 3.3 `ToolbarAction`（工具栏契约）

```ts
interface ToolbarAction {
  type: "button" | "select" | "menu" | "divider";
  id: string;
  label: string;
  icon?: IconRef;                    // lucide 图标名，由消费方映射
  isActive?: () => boolean;
  isEnabled?: () => boolean;
  onExecute?: (editor: Editor) => void;
  options?: ToolbarOption[];         // select/menu
}
```

- core 只负责**计算**（`buildToolbarGroups(editor)` 返回分组）
- 视觉渲染由主题/消费方完成（数据驱动，逻辑零重复）

## 4. 扩展开发规范

**目录约定**（迁移自 blog `rich-text/ext/`）：

```
packages/extensions/src/
├── slash-menu/        # suggestion 数据 + 命令
├── image-block/       # 节点 + 宽度调节逻辑
├── katex/             # 节点（渲染走 EditorDeps）
├── attachment/
├── callout/
├── columns/
├── details/
├── toc-node/
├── block-handles/
├── emoji/
├── markdown/          # 粘贴 + 输入规则
└── styles.css         # 少量可覆盖默认样式（可选）
```

**硬性规范**：

1. 扩展只加语义类名 `tk-*`（如 `tk-image`、`tk-callout`），禁止视觉类名
2. 视觉样式统一放 `styles.css`，消费方可覆盖（样式带 CSS 变量兜底）
3. 禁止直接调用项目 API，一律 `useEditorDeps()`
4. 单文件 ≤ 500 行，超出拆子文件
5. 交互 UI（浮层定位等）放 `@tipkit/ui`，节点逻辑放 `extensions`

## 5. 序列化方案

| 方向 | 实现 | 说明 |
|---|---|---|
| JSON → HTML | `editor.view.serializer` | 服务端渲染可用 |
| HTML → JSON | `editor.schema.nodeFromHTML` | 粘贴/导入 |
| JSON → Markdown | `@tiptap/markdown` v3 `storage.markdown.serializer` | 复制/导出 |
| Markdown → JSON | `@tiptap/markdown` 输入规则 | 粘贴 Markdown |

- 推荐存储格式：**ProseMirror JSON**（无损、可恢复光标结构）
- 渲染端（如 blog 文章页）用 HTML，由消费方自行渲染（可与编辑器解耦）

## 6. SSR 注意事项

1. `immediatelyRender: false`（已在 useTipKitEditor 默认）
2. Katex 渲染走 `EditorDeps.renderKatex`，服务端可注入服务端渲染实现（blog 有 `katex-server.ts` 可复用）
3. demo 中所有编辑器组件标 `"use client"`

## 7. 迁移计划

### M1 核心迁移（基础编辑能力）

1. `core/use-editor.ts`：确认与 blog `use-editor.ts` 的选项对齐
2. `extensions/markdown/`：迁移 `markdown-paste`、`markdown-marks`、`list-input-rules`、`safe-mark-input-rule`、`link-convert`、backfill-convert
3. `core/serialization.ts`：接入 `@tiptap/markdown` v3

### M2 主要编辑体验

1. `extensions/slash-menu/` + `ui/slash-menu/`：迁移 blog `slash-menu.tsx` + `insert-menu.tsx`，剥离视觉
2. `extensions/image-block/`：迁移 `image-block/*`
3. `extensions/code-block/` + 语言菜单
4. `extensions/table/` + `ui/table-controls/`

### M3 高级节点

1. `extensions/katex/`：渲染注入 `EditorDeps.renderKatex`
2. `extensions/attachment/`：上传注入 `EditorDeps.uploadAttachment`
3. `extensions/callout|columns|details|toc|emoji/`
4. `extensions/block-handles/` + `ui/block-handles/`

### M4 接入

1. blog：`rich-text/` 替换为 `@tipkit/editor`，样式迁移到 `blog.css`（从 `editor.css` 抽取变量）
2. devkb：`@devkb/editor` 升级 Tiptap v3，改用 `@tipkit/editor`

## 8. 测试策略

| 层 | 测试 | 工具 |
|---|---|---|
| core | 序列化往返、hook 行为 | vitest + happy-dom |
| extensions | 输入规则、命令、节点 schema | vitest + @tiptap 测试辅助 |
| themes | 无（纯 CSS，人工验证） | — |
| demo | SSR 冒烟（build + dev 启动） | next build |

覆盖率目标：core + extensions ≥ 80%（PRD 非功能需求）。
