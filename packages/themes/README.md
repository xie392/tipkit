# @tipkit/themes

TipKit 内置主题皮肤：**一切视觉样式的唯一归属层**。主题 = CSS 变量 + 自定义 CSS，加载任一主题即可获得完整视觉。

## 安装

```bash
pnpm add @tipkit/themes
```

## 内置主题

| 主题 | 入口 | 说明 |
| --- | --- | --- |
| default | `@tipkit/themes/default.css` | shadcn 标准风格：白底深字、干净排印 |
| sketch | `@tipkit/themes/sketch.css` | 手绘线框：方格纸、手写字体、不规则圆角 |
| dark | `@tipkit/themes/dark.css` | 暗色：深灰背景、浅色正文 |
| base | `@tipkit/themes/base.css` | 布局层（所有主题自动引入，无需手动 import） |

## 快速使用

```ts
import "@tipkit/themes/default.css";
// 或 sketch.css / dark.css
```

```tsx
<div className="tk-theme-sketch">
  <TipKitEditor deps={deps} />
</div>
```

## 自定义主题

复制一个主题 CSS，覆盖其中的 CSS 变量即可，无需修改任何组件代码：

```css
.my-theme {
  --background: #fdf6ec;
  --primary: #e4572e;
  /* ... */
}
```

## 说明

- sketch 主题需要手写字体（Caveat / Patrick Hand），由消费方通过 `next/font` 等方案加载
- 通过 `themes` 数组可编程获取主题元信息（id / name / cssEntry / requiresFonts）
