# @tipkit/core

TipKit 无头核心：编辑器 hook、序列化、依赖注入与共享类型。**零样式**——只描述行为，不携带任何视觉。

## 安装

```bash
pnpm add @tipkit/core
```

## 快速使用

```ts
import { useTipKitEditor, EditorProvider, useEditorDeps } from "@tipkit/core";
import type { EditorDeps } from "@tipkit/core";

const deps: EditorDeps = {
  uploadImage: async (file) => (await upload(file)).url,
  renderKatex: async (tex, displayMode) => renderKatexHtml(tex, { displayMode }),
};

export function App() {
  const editor = useTipKitEditor({
    extensions: [],
    content: "<p>你好</p>",
  });

  return <EditorProvider deps={deps}>{/* 渲染 editor.view.dom */}</EditorProvider>;
}
```

## 主要导出

| 导出 | 说明 |
| --- | --- |
| `useTipKitEditor` | 创建编辑器实例的 hook |
| `EditorProvider` | 依赖注入上下文（`useEditorDeps` 读取） |
| `useEditorDeps` | 扩展内读取注入的上传 / KaTeX 等能力 |
| `EditorDeps` | 依赖契约：`uploadImage` / `uploadAttachment` / `renderKatex` |
| `ToolbarAction` / `ToolbarGroup` | 工具栏数据结构（激活态由 core 计算，视觉交给主题） |
| `OutlineItem` | 目录大纲条目 |

## 设计约束

- 禁止任何颜色、字体、阴影、边框等视觉样式
- 不直接调用项目 API / 全局变量，一律走 `EditorDeps` 注入
