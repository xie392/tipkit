# TipKit

基于 **Tiptap v3 + shadcn/ui** 的无头富文本编辑器套件。编辑器逻辑（工具栏、扩展、序列化）完全共享，**视觉风格由消费方项目决定**——通过加载不同主题 CSS 实现。

## 特性

- 🧩 **无头架构**：core / extensions 零视觉样式，只描述行为
- 🎨 **主题系统**：内置 `devkb.css`（shadcn 默认）与 `blog.css`（手绘线框），自定义风格只需覆盖 CSS 变量
- 🔌 **依赖注入**：图片上传、附件上传、Katex 渲染由消费方注入
- ⚡ **Tiptap v3**：与 blog 对齐，Markdown 双向转换（`@tiptap/markdown`）
- 🧪 **SSR 安全**：默认 `immediatelyRender: false`

## Monorepo 结构

```
apps/demo/          # Next.js 演示（/devkb、/blog 双主题）
packages/core/      # 无头核心：useTipKitEditor、序列化、EditorDeps
packages/extensions/# 全部 Tiptap 扩展（斜杠菜单、katex、附件、分栏…）
packages/ui/        # 无头 UI 原语（浮层定位、键盘导航、激活态）
packages/components/# shadcn 基础组件
packages/themes/    # 主题皮肤（devkb.css / blog.css / base.css）
packages/editor/    # 聚合入口 <TipKitEditor>
```

## 快速开始

```bash
pnpm install
pnpm dev            # 打开 http://localhost:3000，选择主题
```

消费方接入：

```tsx
import { TipKitEditor } from "@tipkit/editor";
import "@tipkit/themes/blog.css"; // 或 devkb.css

<TipKitEditor
  deps={{ uploadImage: myUpload }}
  placeholder="写下点什么…"
  onChange={(editor) => save(editor.getHTML())}
/>
```

## 文档

- [PRD（需求）](docs/PRD.md)
- [架构设计](docs/ARCHITECTURE.md)
- [技术设计](docs/TECHNICAL-DESIGN.md)
