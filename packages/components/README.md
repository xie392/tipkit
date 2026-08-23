# @tipkit/components

TipKit 的 shadcn/ui 风格基础组件：基于 Radix 原语 + cva 变体，颜色一律走 CSS 变量，随主题联动。

## 安装

```bash
pnpm add @tipkit/components
```

## 快速使用

```tsx
import {
  Button,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@tipkit/components";

export function Demo() {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">悬停我</Button>
        </TooltipTrigger>
        <TooltipContent>提示内容</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

## 说明

- 组件颜色使用 shadcn 语义变量（`--background` / `--primary` / `--muted` 等），在 `@tipkit/themes` 中定义
- 需配合主题 CSS 使用，否则颜色变量缺失会回退到默认值
