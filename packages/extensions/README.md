# @tipkit/extensions

TipKit 全部 Tiptap 扩展：基础编辑能力 + 高级内容节点。只携带 `tk-*` 语义类名，视觉由主题层负责。

## 安装

```bash
pnpm add @tipkit/extensions
```

## 快速使用

```ts
import {
  createBasicExtensions,
  createAdvancedExtensions,
  getInsertActions,
} from "@tipkit/extensions";
```

## 扩展集合

### 基础扩展 `createBasicExtensions()`

段落、标题、加粗、斜体、删除线、行内代码、下划线、高亮、文字颜色/字体/字号、对齐、列表、任务列表、表格、链接（Markdown 输入规则 + 自动链接）、分隔线（可交互包裹）、Markdown 粘贴/序列化，以及链接 / 行内代码的 IME 兜底转换（`LinkBackfillConvert` / `CodeBackfillConvert`）。

### 高级扩展 `createAdvancedExtensions()`

斜杠菜单、图片块（可缩放对齐）、代码块高亮、KaTeX 公式、Callout 提示框、分栏、折叠块、页面目录、Iframe、附件。

### 独立导出

| 导出 | 说明 |
| --- | --- |
| `getInsertActions` | 斜杠菜单 / 插入面板的动作数据 |
| `CustomHorizontalRule` | 可交互分隔线（块手柄 / 块菜单可命中） |
| `LinkBackfillConvert` | `[文字](url)` IME 兜底转链接 |
| `CodeBackfillConvert` | `` `code` `` 兜底转行内代码 |
| `ImageBlock` / `Katex` / `Callout` / `Columns` / `Details` / `Iframe` / `Attachment` 等 | 单个扩展按需引入 |

## 设计约束

- 扩展自包含（内部相对导入），可整体裁剪
- 只加语义类名 `tk-*`，禁止项目特定类名
- 项目特定能力（上传 / KaTeX 渲染）通过 `useEditorDeps()` 注入
