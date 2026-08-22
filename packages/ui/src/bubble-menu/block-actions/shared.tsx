"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@tipkit/components";
import { IconChevronDown } from "./icons";

export function BlockTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <BlockTooltip label={label}>
      <button
        type="button"
        className={`tk-block-action-btn${active ? " is-active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {icon}
      </button>
    </BlockTooltip>
  );
}

export function ActionDropdown({
  icon,
  label,
  children,
  width = 120,
}: {
  icon: ReactNode;
  label: string;
  children: (close: () => void) => ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="tk-block-action-dropdown">
      <BlockTooltip label={label}>
        <button
          type="button"
          className="tk-block-action-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
        >
          {icon}
          <IconChevronDown />
        </button>
      </BlockTooltip>
      {open && (
        <div className="tk-block-action-menu" contentEditable={false} style={{ minWidth: width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function ActionMenuItem({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`tk-block-action-item${active ? " is-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
