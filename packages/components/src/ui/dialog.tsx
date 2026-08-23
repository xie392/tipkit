"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/utils";

/* 精简 shadcn dialog（Radix 封装） */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="tk-fixed tk-inset-0 tk-z-100 tk-bg-black-50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "tk-fixed tk-left-half tk-top-half tk-z-100 tk-w-full tk-max-w-md tk-center-modal tk-rounded-lg tk-border tk-border-border tk-bg-background tk-p-6 tk-shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("tk-mb-4 tk-flex tk-flex-col tk-gap-1-5", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("tk-text-lg tk-font-semibold tk-leading-none", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("tk-text-sm tk-text-muted-fg", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("tk-flex tk-flex-col-reverse tk-gap-2 tk-sm-flex-row tk-sm-justify-end", className)}
    {...props}
  />
);

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
