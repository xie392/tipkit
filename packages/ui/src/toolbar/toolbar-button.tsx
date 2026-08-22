"use client";

import { cn } from "@tipkit/components";

/* 工具栏按钮（迁移自 blog toolbar.tsx 的 ToolbarBtn，语义化）：
 * 视觉走主题 CSS（tk-toolbar-btn），仅接受 title/active/disabled/className。
 * 必须透传 rest props：Radix asChild（DropdownMenuTrigger 等）会注入
 * onPointerDown/ref/data-state 等，不透传则下拉菜单点击后无法打开。 */
export function ToolbarBtn({
  title,
  active,
  disabled,
  className,
  children,
  ...rest
}: {
  title?: string;
  /** asChild 模式下由 DropdownMenuTrigger 注入，可为空 */
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      data-active={active || undefined}
      className={cn("tk-toolbar-btn inline-flex items-center justify-center", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
