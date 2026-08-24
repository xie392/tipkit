---
name: integration
description: 在任意 Next.js / React 项目中接入 TipKit 编辑器（npm 包）。当用户需要引入 @tipkit 系列包、配置 TipKitEditor、注入上传/渲染/i18n 依赖或切换主题时使用。
---

# TipKit 接入（消费方项目）

## 概述

TipKit 以 npm 包形式分发（`@tipkit/editor`、`@tipkit/extensions`、`@tipkit/core`、`@tipkit/ui`、`@tipkit/components`、`@tipkit/themes`）。消费方只需安装包即可使用，**不需要 TipKit 源码**。接入 = 安装包 → `<TipKitEditor>` 聚合入口 + 注入 `EditorDeps` + 引入主题 CSS。

核心原则：**消费方只注入"项目能力"与"选主题"，不修改包内代码**。上传/渲染/文案通过 `EditorDeps` 注入，视觉通过主题层控制。

## 何时使用

- 新项目要接入 TipKit（Next.js App Router / React 应用）
- 现有接入要配置图片/附件上传、KaTeX 渲染、i18n
- 要切换主题皮肤或做消费方自定义样式
- 排查接入后编辑器不渲染 / SSR 报错 / 上传失效等问题

### 不要用

- 想改 TipKit 内部行为——在自有项目里做自定义扩展（见 `new-extension` 技能）或向 TipKit 提需求
- 只换个别文案——覆盖词典即可（见 `add-language` 技能）

## 铁律

```
不修改 @tipkit 包内代码；项目特定能力一律经 EditorDeps 注入，视觉一律经主题 CSS 覆盖
```

## 流程

### 阶段 1：安装依赖

目的：引入全部所需包。

操作：

```bash
pnpm add @tipkit/editor @tipkit/extensions @tipkit/ui @tipkit/components @tipkit/themes @tipkit/core
```

> 本地联调期：在消费方 `package.json` 用 `workspace:*` / `file:` 引用本地包；发布到 npm 后按版本号安装。

通过标准：
- [ ] 依赖已安装、可解析

### 阶段 2：最小可用接入

目的：跑通编辑器渲染。

操作：
1. 写一个 client 组件：

```tsx
"use client";
import { TipKitEditor } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import "@tipkit/themes/default.css";

export function MyEditor() {
  return (
    <TipKitEditor
      deps={{}}
      extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]}
      onChange={(editor) => save(editor.getHTML())}
    />
  );
}
```

2. 需要交互原语（斜杠菜单/浮动菜单/链接气泡/表格控制条）时，在 `<TipKitEditor>` 的 children 里挂 `@tipkit/ui` 组件：

```tsx
<TipKitEditor deps={deps} extensions={extensions}>
  {(editor) =>
    editor ? (
      <TooltipProvider delayDuration={300}>
        <SlashMenu editor={editor} onUploadImage={deps.uploadImage} iconRenderer={renderIcon} />
        <EmojiSuggestion editor={editor} />
        <TextMenu editor={editor} />
        <LinkBubble editor={editor} />
        <LinkDialogHost editor={editor} />
        <BlockBubbleMenu editor={editor} />
        <BlockHandleMenu editor={editor} />
        <TableControls editor={editor} />
      </TooltipProvider>
    ) : null
  }
</TipKitEditor>
```

> **`SlashMenu` 必须传 `iconRenderer`**：斜杠菜单的图标名（如 `"Heading1"`、`"Table2"`）是字符串，消费方需用自己项目的图标库（推荐 lucide-react）映射为实际图标；不传会直接显示字符串文字。示例：

```tsx
import { Heading1, Heading2, Text, List, Quote, Code2, Table2, Image as ImageIcon, Link, Columns2, Smile, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = { Heading1, Heading2, Text, List, Quote, Code2, Table2, Image: ImageIcon, Link, Columns2, Smile /* ... */ };
const renderIcon = (icon: string) => { const Icon = ICON_MAP[icon]; return Icon ? <Icon className="w-4 h-4" /> : null; };
```

完整图标名清单见 `@tipkit/extensions` 的 `getInsertActions()` 返回值。

通过标准：
- [ ] 编辑器渲染成功、可输入
- [ ] 无 SSR/hydration 报错

### 阶段 3：注入 EditorDeps

目的：把项目能力接进来。

操作：
1. 按 `EditorDeps` 契约注入（字段如下，全部可选）：

```ts
interface EditorDeps {
  /** 图片上传：返回可用于 <img src> 的 URL */
  uploadImage?: (file: File, editor: Editor) => Promise<string>;
  /** 附件上传：返回附件元数据 */
  uploadAttachment?: (file: File, editor: Editor) => Promise<{ url: string; name: string; size: number; mimeType: string }>;
  /** Katex 渲染：返回渲染后的 HTML（SSR 安全） */
  renderKatex?: (tex: string, displayMode: boolean) => Promise<string>;
  /** i18n 翻译函数。不传时默认中文 */
  t?: (key: string) => string;
}
```

2. 也可用 `<EditorProvider deps={...}>` 包裹子树，供 `useEditorDeps()` / `useT()` 读取（这两个 hook 从 `@tipkit/core` 导出）
3. 未注入的能力会退化（如图片 base64 预览），生产环境必须全部注入

通过标准：
- [ ] 上传/渲染/文案在页面中可验证

### 阶段 4：主题与自定义

目的：让视觉符合消费方品牌。

操作：
1. 选内置主题，换一行 import 即可：

```ts
import "@tipkit/themes/default.css"; // shadcn 标准
import "@tipkit/themes/sketch.css";  // 手绘线框
import "@tipkit/themes/dark.css";    // 暗色
```

2. 自定义：复制一个主题 CSS 覆盖变量，或在语义类 `tk-*` 基础上覆盖样式
3. 消费方可通过 `className` 在 `<TipKitEditor>` 上挂自己的根类名

通过标准：
- [ ] 消费方页面视觉符合预期

### 阶段 5：i18n

目的：多语言。

操作：

```ts
import { createT, en } from "@tipkit/core";
<EditorProvider deps={{ t: createT(en) }}>
```

或局部覆盖词典：`{ ...zh, "toolbar.undo": "撤销操作" }`。

通过标准：
- [ ] 目标语言文案生效、无裸露英文 key

### 阶段 6：验证

目的：确保 SSR 与构建正常。

操作：
- SSR：确认 `immediatelyRender` 默认 `false`（Tiptap v3 默认相反，TipKit 已兜底），不要在 SSR 下改回 `true`
- 运行 `pnpm type-check`、`pnpm build`
- 生产环境手动验证：粘贴、上传、斜杠菜单、序列化输出

通过标准：
- [ ] type-check / build 通过
- [ ] 生产环境核心交互正常

## 何时停下来寻求澄清

- 消费方项目技术栈不符（非 Next.js/React）——确认是否支持
- 上传接口协议未定——先确认返回结构与失败处理
- 需要 TipKit 没有的能力——判断是注入实现还是新增自定义扩展（`new-extension`）

## 常见错误 / 危险信号

> **如果你正在做以下事情，你已经犯错——立刻停下来。**

**"直接改 node_modules 里的 @tipkit 代码来调样式。"**
错。包内代码不可修改；改包会丢失且无法升级。走主题 CSS 或提交上游。

**"编辑器 SSR 报错，我先把 immediatelyRender 改成 true。"**
错。SSR 必须 `false`；报错根因多半是服务端渲染 DOM 差异，改回 true 是掩盖问题。

**"上传接口还没好，先用个假 URL 顶一下。"**
错。假 URL 会让生产环境图片裂开；应注入真实实现或用明确的未注入降级。

**"demo 里有一堆 ui 组件，我以为都要加。"**
错。交互原语按需引入（斜杠菜单、浮动菜单等），不需要的别挂。

**"斜杠菜单图标位置显示 Heading1、Text 这些文字。"**
错。`SlashMenu` 的 `iconRenderer` 没传。用 lucide-react 建图标映射后传入，详见阶段 2 示例。

## 与其他技能/流程集成

- 需要新语言 → 见 `add-language` 技能
- 需要新内容能力 → 见 `new-extension` 技能

## 验证清单

- [ ] 依赖安装、`<TipKitEditor>` 渲染成功
- [ ] SlashMenu 已传 `iconRenderer`，菜单项显示图标而非文字
- [ ] EditorDeps 已按契约注入（上传/渲染/文案）
- [ ] 主题 CSS 已引入、视觉符合预期
- [ ] i18n 生效
- [ ] `pnpm type-check`、`pnpm build` 通过
- [ ] 生产环境核心交互验证通过
