"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/utils";

/* 精简 shadcn tooltip（Radix 封装）
 * 注意：content 通过 Portal 挂到 body，会脱离主题 CSS 变量作用域，
 * 因此这里用固定深色样式（黑底白字 + 小箭头），不依赖主题变量，
 * 保证在任何主题/容器下都可见。 */
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[100] overflow-hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-white shadow-md",
        "bg-neutral-900",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-neutral-900" width={10} height={5} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
