"use client";

import * as React from "react";
import { cn } from "../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "tk-flex tk-h-9 tk-w-full tk-rounded-md tk-border tk-border-border tk-bg-background tk-px-3 tk-py-1 tk-text-sm tk-shadow-xs tk-transition-colors tk-placeholder-muted-fg tk-focus-outline-none tk-focus-border-fg-50 tk-disabled-cursor-na tk-disabled-opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
