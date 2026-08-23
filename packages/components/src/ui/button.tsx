"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "tk-inline-flex tk-items-center tk-justify-center tk-gap-2 tk-whitespace-nowrap tk-rounded-md tk-text-sm tk-font-medium tk-transition-colors tk-focus-outline-none tk-disabled-pointer-none tk-disabled-opacity-50 tk-btn-svg tk-shrink-0",
  {
    variants: {
      variant: {
        default: "tk-bg-primary tk-text-primary-fg tk-shadow-xs tk-hover-bg-primary-90",
        ghost: "tk-hover-bg-accent tk-hover-text-accent-fg",
        outline:
          "tk-border tk-border-border tk-bg-background tk-shadow-xs tk-hover-bg-accent tk-hover-text-accent-fg",
        secondary: "tk-bg-secondary tk-text-secondary-fg tk-shadow-xs tk-hover-bg-secondary-80",
      },
      size: {
        default: "tk-h-9 tk-px-4 tk-py-2",
        sm: "tk-h-8 tk-rounded-md tk-px-3",
        icon: "tk-h-8 tk-w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
