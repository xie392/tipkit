---
name: add-language
description: 为使用 TipKit 的应用设置或覆盖编辑器多语言。当用户需要切换编辑器界面语言（英文/日文等）、翻译或覆盖默认中文文案时使用。
---

# TipKit 多语言（消费方）

## 概述

TipKit 编辑器界面文案默认中文。消费方通过 `@tipkit/core` 公开导出的 `zh`（中文）、`en`（英文）词典与 `createT()` 翻译函数注入语言，**无需访问 TipKit 源码**。key 使用扁平 dot notation（如 `"toolbar.undo"`）。

核心原则：**用 `@tipkit/core` 导出的词典做基础，只改 value、不改 key**；key 是消费方覆盖与持久化的契约。

## 何时使用

- 用户要求编辑器界面显示英文/日文等非默认语言
- 用户要求覆盖个别中文文案（如把"撤销"改成"撤销操作"）
- 用户要求统一某个 UI 文案的翻译

### 不要用

- 只改自己的页面文案（那是应用自身的 i18n，与编辑器无关）
- 想让 TipKit 内置一个新语言（那是 TipKit 仓库层面的需求，见说明）

## 铁律

```
key 是契约，禁止改动；新增语言必须覆盖全部 key，否则未覆盖项会显示英文 key（如 toolbar.undo），比回退中文更糟
```

## 流程

### 阶段 1：了解可用的公开 API

目的：确认用什么注入语言。

操作：
- 从 `@tipkit/core` 导入：

```ts
import { zh, en, createT, type Messages } from "@tipkit/core";
```

- `zh` / `en`：内置词典（`Record<string, string>`）
- `createT(messages)`：由词典生成翻译函数 `(key: string) => string`，未命中返回 key 本身
- `EditorProvider`（`@tipkit/core`）接收 `deps.t`；`<TipKitEditor>` 内部已提供 Provider，也可自行包裹

通过标准：
- [ ] 确认 `import { zh, en, createT } from "@tipkit/core"` 可解析

### 阶段 2：注入语言

目的：让编辑器界面语言生效。

操作（按需选一种）：

**方案 A：整体换一种新语言**（用内置中文词典做键清单，逐 key 翻译）

```ts
import { zh, createT, type Messages } from "@tipkit/core";

const ja: Messages = {};
for (const key of Object.keys(zh)) {
  // 逐个把 zh[key] 翻译成日文；每个 key 都要翻译
  ja[key] = translate(zh[key]);
}

// 通过 EditorProvider 注入（编辑器组件放在其内部）
<EditorProvider deps={{ t: createT(ja) }}>...</EditorProvider>
```

**方案 B：使用内置英文**

```ts
import { en, createT } from "@tipkit/core";
<EditorProvider deps={{ t: createT(en) }}>...</EditorProvider>
```

**方案 C：只覆盖个别文案**（以 zh 为基础展开覆盖）

```ts
import { zh, createT } from "@tipkit/core";
const myDict = { ...zh, "toolbar.undo": "撤销操作", "slash.image.label": "插入图片" };
<EditorProvider deps={{ t: createT(myDict) }}>...</EditorProvider>
```

> 说明：`Object.keys(zh)` 可拿到全部 key 清单，避免遗漏；也可在运行时基于 `zh` 生成各语言词典并存 JSON，由应用按需加载。

通过标准：
- [ ] 语言已注入、编辑器界面文案切换生效
- [ ] 全量覆盖时无裸露英文 key

### 阶段 3：验证

目的：确认无遗漏与类型正确。

操作：

```bash
pnpm type-check   # Messages 类型正确
pnpm build        # 构建通过
```

- 页面手动切换语言，核对工具栏/斜杠菜单/浮层/对话框文案

通过标准：
- [ ] type-check / build 通过
- [ ] 目标语言下无裸露英文 key

## 何时停下来寻求澄清

- 目标语言不明确（用户没说是哪种语言）——先问
- 专业术语（如 LaTeX 公式提示）难以翻译——询问是否保留英文原样
- 用户想让"所有消费方默认得到新语言"——那是 TipKit 内置语言需求，需在 TipKit 仓库加词典并发布新版本，本技能只管消费方注入

## 常见错误 / 危险信号

> **如果你正在做以下事情，你已经犯错——立刻停下来。**

**"这个语言缺几个 key 没关系，反正会回退中文。"**
错。缺失 key 会显示英文 key（如 `toolbar.undo`），比回退中文更糟。用 `Object.keys(zh)` 保证全覆盖。

**"我把 key 也改了，这样更语义化。"**
错。key 是契约，改 key 会导致旧覆盖失效、消费方数据/序列化文案漂移。

**"直接去 node_modules 里改 @tipkit 的词典文件。"**
错。包内代码不可修改；改包会丢失且无法升级。用词典覆盖 + `EditorProvider` 注入。

## 与其他技能/流程集成

- 接入 TipKit 与注入 deps → 见 `integration` 技能
- 在自有项目里给编辑器加自定义内容类型 → 见 `new-extension` 技能

## 验证清单

- [ ] 从 `@tipkit/core` 正确导入 `zh`/`en`/`createT`
- [ ] 全量覆盖时键集合与 `zh` 一致（无遗漏、无多余）
- [ ] `EditorProvider deps={{ t }}` 已注入
- [ ] `pnpm type-check`、`pnpm build` 通过
- [ ] 目标语言下无裸露英文 key
