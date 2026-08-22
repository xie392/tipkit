"use client";

import type { BlockActionProps } from "./types";
import { IconChevronRight } from "./icons";
import { ActionButton } from "./shared";

export function DetailsActions({ node, updateAttributes }: BlockActionProps) {
  const isOpen = !!node.attrs.open;

  return (
    <ActionButton
      icon={<IconChevronRight />}
      label={isOpen ? "折叠" : "展开"}
      active={isOpen}
      onClick={() => updateAttributes({ open: !isOpen })}
    />
  );
}
