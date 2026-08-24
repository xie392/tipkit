"use client";

import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import { IconChevronRight } from "./icons";
import { ActionButton } from "./shared";

export function DetailsActions({ node, updateAttributes }: BlockActionProps) {
  const t = useT();
  const isOpen = !!node.attrs.open;

  return (
    <ActionButton
      icon={<IconChevronRight />}
      label={isOpen ? t("details.collapse") : t("details.expand")}
      active={isOpen}
      onClick={() => updateAttributes({ open: !isOpen })}
    />
  );
}
