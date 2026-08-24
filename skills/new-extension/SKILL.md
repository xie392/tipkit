---
name: new-extension
description: 在接入 TipKit 的项目里新增自定义 Tiptap 扩展/节点/mark/命令。当用户需要给 TipKit 编辑器加新的内容类型、块节点、行内样式或命令时使用。
---

# TipKit 自定义扩展（消费方）

## 概述

TipKit 基于 Tiptap v3。消费方可在**自己的项目里**用 `@tiptap/core` 定义扩展（节点/mark/命令），把它加进 `<TipKitEditor>` 的 `extensions` 数组即可，**无需修改 TipKit 包、无需访问 TipKit 源码**。

核心原则：**扩展就是标准 Tiptap 扩展**——声明属性 + `parseHTML`/`renderHTML`；需要外部能力（上传/渲染/文案）时用 `@tipkit/core` 的 `useEditorDeps()` / `useT()`。

## 何时使用

- 用户要求给编辑器加一个自有内容类型（如时间戳节点、表格变体）
- 用户要求行内 mark、快捷键命令或输入规则
- 用户要求扩展接入既有 TipKit 编辑器

### 不要用

- 想改 TipKit 自带节点的行为——应通过配置参数或向 TipKit 提需求
- 视觉样式定制——在你自己的项目里写 CSS 即可，不必动编辑器逻辑

## 铁律

```
不修改 @tipkit 包内代码；自定义扩展写在自有项目中，节点/命令是标准 Tiptap 定义
```

## 流程

### 阶段 1：确定扩展类型与安装依赖

目的：选对扩展基类、装好 Tiptap 依赖。

操作：
1. 判断类型：
   - 块级内容（独占一行/一段）→ `Node`
   - 行内样式（加粗、链接这类）→ `Mark`
   - 纯逻辑（快捷键、输入规则、命令）→ `Extension`
2. 安装依赖（消费方项目）：

```bash
pnpm add @tiptap/core @tiptap/react @tipkit/core
```

通过标准：
- [ ] 依赖已安装

### 阶段 2：定义扩展

目的：实现节点/命令逻辑。

操作（块节点示例，完整内嵌可照抄）：

```tsx
"use client";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useT } from "@tipkit/core";

// 声明命令类型（可选）
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    myNode: { setMyNode: () => ReturnType };
  }
}

export const MyNode = Node.create({
  name: "myNode",
  group: "block",          // 块节点
  content: "inline*",      // 可容纳行内内容
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      note: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-note"),
        renderHTML: (a) => (a.note ? { "data-note": a.note } : {}),
      },
    };
  },

  parseHTML: () => [{ tag: 'div[data-type="myNode"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["div", mergeAttributes(HTMLAttributes, { "data-type": "myNode" }), 0],

  addCommands() {
    return {
      setMyNode:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },

  // 有 React 视图时启用
  addNodeView() {
    return ReactNodeViewRenderer(MyNodeView);
  },
});

function MyNodeView({ node }: NodeViewProps) {
  const t = useT(); // 文案走 i18n（EditorProvider 内有效）
  return (
    <NodeViewWrapper data-type="myNode" data-note={node.attrs.note}>
      <span className="tk-my-node-tag">{t("myNode.label") ?? "自定义节点"}</span>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
```

要点：
- 纯逻辑（无 DOM）扩展写 `.ts`；带 React 视图写 `.tsx` 并加 `"use client"`
- 属性必须定义 `parseHTML` / `renderHTML`，保证序列化/粘贴一致
- 需要上传/渲染能力时用 `useEditorDeps()`，文案用 `useT()`（组件需在 `EditorProvider` 内渲染）

通过标准：
- [ ] 扩展能在测试内容里解析、序列化往返一致
- [ ] 无直接调用业务接口

### 阶段 3：样式（自包含）

目的：让新节点在消费方项目里有视觉。

操作：
- 在消费方项目自己的 CSS 里，用 `data-type="myNode"` 或 `tk-*` 类写样式（scoped，避免污染）
- 若想跟随 TipKit 主题体系，可用 `tk-` 前缀类名并在项目里覆盖

通过标准：
- [ ] 新节点渲染样式正常

### 阶段 4：注册进编辑器

目的：让 TipKit 编辑器加载自定义扩展。

操作：

```tsx
<TipKitEditor
  deps={deps}
  extensions={[...createBasicExtensions(), ...createAdvancedExtensions(), MyNode]}
/>
```

- 需要 `/` 斜杠菜单唤起：把扩展命令映射到你自己的斜杠菜单数据里（若你的菜单是自定义的）；TipKit 内置斜杠菜单（`@tipkit/ui` 的 `SlashMenu`）基于 `getInsertActions()` 构建，自定义节点需按你项目里的菜单配置方式加入

通过标准：
- [ ] 新节点可在编辑器里插入、选中、删除
- [ ] （若需要）可在斜杠菜单唤起

### 阶段 5：验证

目的：确保不破坏现有编辑。

操作：

```bash
pnpm type-check
pnpm build
```

- 手动验证：插入、选中、复制粘贴、序列化输出、SSR 下正常

通过标准：
- [ ] type-check / build 通过
- [ ] 插入/序列化/复制粘贴正常

## 何时停下来寻求澄清

- 需要的行为更像"修改 TipKit 自带节点"而非新增——确认是配置参数还是提需求
- 扩展要依赖新的注入能力（如新的 deps 字段）——确认你的项目能提供
- 涉及复杂序列化/粘贴——确认 `parseHTML`/`renderHTML` 与 markdown 序列化的兼容

## 常见错误 / 危险信号

> **如果你正在做以下事情，你已经犯错——立刻停下来。**

**"我直接把 node_modules 里 @tipkit/extensions 改一下加个节点。"**
错。包内代码不可修改；改包会丢失且无法升级。扩展写在自有项目里注册。

**"属性没写 parseHTML/renderHTML，反正现在能用。"**
错。缺了会导致粘贴、序列化、刷新后属性丢失。

**"文案硬编码中文，不通过 useT()。"**
错。默认中文没问题，但要跟随应用语言就得走 `@tipkit/core` 的 `useT()` 与词典覆盖（见 `add-language`）。

## 与其他技能/流程集成

- 编辑器界面语言/词典 → 见 `add-language` 技能
- 项目接入与 deps 注入 → 见 `integration` 技能

## 验证清单

- [ ] 扩展是标准 Tiptap `Node`/`Mark`/`Extension`，写在自有项目
- [ ] 属性有 `parseHTML`/`renderHTML`
- [ ] 已加入 `<TipKitEditor extensions>` 数组
- [ ] 样式自包含、不污染
- [ ] `pnpm type-check`、`pnpm build` 通过
- [ ] 插入/序列化/复制粘贴/SSR 手动验证通过
