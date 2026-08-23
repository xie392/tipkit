# TipKit 产品需求文档（PRD）

> 版本：v0.1（骨架阶段）
> 状态：需求评审中

## 1. 背景与问题

- **blog** 项目：Next.js 16 + Tiptap v3，`src/components/rich-text/` 已有功能完整的编辑器（约 50 个文件），但**耦合在项目内**（路径别名 `@/`、项目上传接口、手绘风格类名）。
- **devkb** 项目：pnpm/turbo monorepo，`@devkb/editor` 包已是"Tiptap v2 + shadcn 风格"封装，但功能基础、版本落后（v2）。
- 现状：两份编辑器各自维护，功能不对齐，迁移成本高。

**目标**：创建一个独立的、无头的富文本编辑器套件 **TipKit**（基于 Tiptap v3 + shadcn/ui），功能完整，**风格由消费方项目完全决定**，blog 与 devkb 共用同一套编辑逻辑。

## 2. 目标用户与场景

| 用户 | 场景 |
|---|---|
| blog 项目 | 文章编辑器，手绘线框风格，需要 katex/附件/分栏等高级功能 |
| devkb 项目 | 知识库文档编辑器 + AI 对话，常规 shadcn 风格 |
| 其他项目 | 通过 CSS 变量 / 主题包接入任意风格 |

## 3. 需求范围

### 3.1 功能清单（编辑器能力）

**基础格式（P0）**

- [x] 粗体 / 斜体 / 删除线 / 下划线 / 上下标 / 高亮 / 颜色 / 字号 / 字体族（从 blog 迁移）
- [x] 标题 H1-H3、段落、引用、对齐方式
- [x] 无序 / 有序 / 任务列表

**块级节点（P0）**

- [x] 代码块（lowlight 高亮 + 语言选择）
- [x] 图片块（对齐、宽度调节、悬停工具条）
- [x] 表格（行列增删、合并、表头）
- [x] 斜杠菜单（`/` 触发，建议 + 命令）

**高级节点（P1）**

- [x] 公式（Katex，客户端渲染；SSR 场景可注入 EditorDeps.renderKatex）
- [x] 附件上传（依赖注入 uploadAttachment）
- [x] 提示块 callout（5 种风格 + emoji 选择）
- [x] 分栏 columns（双栏 + 侧栏布局）
- [x] 折叠块 details
- [x] 目录节点 TOC（自动扫描 heading，点击跳转）
- [x] Emoji 建议 + 选择器（`:xxx` 触发）
- [x] 块句柄（悬停 + 号插入 / ⋮⋮ 拖拽）

**P2**

- [x] iframe 嵌入（URL 输入 + 高度拖拽）
- [ ] 链接卡片（依赖 link-preview 服务，未迁移）
- [ ] 表格控制条（列宽拖拽）

**内容交互（P0）**

- [x] Markdown 粘贴转换、输入规则（`# `、`- `、`1. `、`[] ` 等）
- [x] 选中文字浮层（链接气泡、文字工具条）
- [x] 占位符（支持随机多条提示语）

**序列化（P0）**

- [ ] JSON ↔ HTML ↔ Markdown 双向转换（基于 @tiptap/markdown v3）

> 注：`[x]` 表示逻辑从 blog 迁移已具备；`[ ]` 表示待实现。

### 3.2 主题系统（P0）

- [x] 内置两套主题：`default.css`（shadcn 默认变量）、`sketch.css`（手绘风格：方格纸、手写字体、sketch 边框）
- [x] 主题 = CSS 变量 + 自定义 CSS，消费方可通过覆盖变量自定义风格
- [x] core/extensions/ui 不允许出现视觉样式（颜色/字体/阴影）

### 3.3 依赖注入（P0）

| 能力 | 注入点 | 说明 |
|---|---|---|
| 图片上传 | `EditorDeps.uploadImage` | 返回可显示的 URL |
| 附件上传 | `EditorDeps.uploadAttachment` | 返回附件元数据 |
| Katex 渲染 | `EditorDeps.renderKatex` | 支持服务端渲染 |

### 3.4 不在范围（Out of Scope）

- 后端存储、权限、多租户（消费方负责）
- AI 集成 / RAG（devkb 自研）
- 移动端专项优化（跟随消费方）

## 4. 非功能需求

| 维度 | 要求 |
|---|---|
| 性能 | 编辑器首次渲染不阻塞主线程；长文档（>1 万字）输入流畅 |
| SSR | 必须支持 Next.js SSR（immediatelyRender: false） |
| 包体积 | 扩展按需引入，基础包尽量小 |
| 可维护 | 单文件 ≤ 500 行；扩展目录自包含 |
| 测试 | vitest + happy-dom，核心逻辑覆盖率 ≥ 80% |

## 5. 成功标准

1. blog 与 devkb 用同一套 `@tipkit/editor` 渲染各自风格的编辑器，功能一致
2. blog 现有全部功能迁移后行为不变（diff 对齐）
3. 新项目接入成本：一条依赖 + 一个主题 import + 注入上传函数
4. demo 可一键启动，双主题对比展示

## 6. 里程碑

| 阶段 | 内容 | 产出 |
|---|---|---|
| M0 骨架（当前） | monorepo、包结构、docs、demo 双主题 | 可启动的 demo |
| M1 核心迁移 | 基础格式 + markdown 输入规则 + 序列化 | blog 基础编辑能力 |
| M2 高级扩展 | 斜杠菜单、图片块、代码块、表格 | 主要编辑体验 |
| M3 高级节点 | katex、附件、callout、分栏、TOC 等 | 全功能对齐 blog |
| M4 接入 | blog / devkb 迁移到 @tipkit/editor | 双项目共用 |
