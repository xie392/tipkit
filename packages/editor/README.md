# @tipkit/editor

TipKit 聚合入口：一个 `<TipKitEditor>` 组件，组合依赖注入、编辑器实例与内容区。消费方无需感知内部包。

## 安装

```bash
pnpm add @tipkit/editor @tipkit/extensions @tipkit/themes
```

## 快速使用

```tsx
"use client";

import { TipKitEditor } from "@tipkit/editor";
import type { EditorDeps } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import "@tipkit/themes/default.css";

const deps: EditorDeps = {
  uploadImage: async (file) => (await uploadToServer(file)).url,
};

export default function App() {
  return (
    <TipKitEditor
      deps={deps}
      placeholder="输入 / 打开斜杠菜单…"
      extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]}
      onChange={(editor) => save(editor.getHTML())}
    />
  );
}
```

## Props

| Prop | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `deps` | `EditorDeps` | 是 | 项目特定能力注入（上传 / KaTeX 等） |
| `extensions` | `Extension[]` | 否 | 追加扩展；默认使用基础扩展集合 |
| `content` | `string \| Record<string, unknown>` | 否 | 初始内容（HTML 或 JSON） |
| `placeholder` | `string` | 否 | 空状态占位文案 |
| `onChange` | `(editor) => void` | 否 | 内容更新回调 |
| `onCreate` | `(editor) => void` | 否 | 编辑器就绪回调 |
| `immediatelyRender` | `boolean` | 否 | SSR 传 false（默认 false） |
| `className` | `string` | 否 | 容器类名 |
| `children` | `ReactNode \| (editor) => ReactNode` | 否 | 渲染插槽，挂载浮层 / 工具栏 |

## 其他导出

- `buildToolbarGroups(editor)`：由编辑器计算基础工具栏分组数据
- `useTipKitEditor` / `EditorProvider` / `useEditorDeps`：透传自 `@tipkit/core`
- 类型：`EditorDeps`、`ToolbarAction`、`ToolbarGroup`、`OutlineItem` 等

## 完整示例

参考 [apps/demo](https://github.com/xie392/tipkit/tree/master/apps/demo) —— 含斜杠菜单、文字工具条、链接气泡、块手柄、表格控件等全部浮层。
