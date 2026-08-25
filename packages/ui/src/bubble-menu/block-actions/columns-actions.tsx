"use client";

import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import { ActionButton } from "./shared";
import { ColumnLayout } from "@tipkit/extensions";

function IconTwoCol() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="5.5" height="10" rx="1" />
      <rect x="8.5" y="3" width="5.5" height="10" rx="1" />
    </svg>
  );
}

function IconLeftNarrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="3.5" height="10" rx="1" />
      <rect x="6.5" y="3" width="7.5" height="10" rx="1" />
    </svg>
  );
}

function IconRightNarrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="7.5" height="10" rx="1" />
      <rect x="10.5" y="3" width="3.5" height="10" rx="1" />
    </svg>
  );
}

export function ColumnsActions({ node, updateAttributes }: BlockActionProps) {
  const t = useT();
  const layout = (node.attrs.layout as ColumnLayout) ?? ColumnLayout.TwoColumn;

  return (
    <>
      <ActionButton
        icon={<IconTwoCol />}
        label={t("columns.twoColumn")}
        active={layout === ColumnLayout.TwoColumn}
        onClick={() => updateAttributes({ layout: ColumnLayout.TwoColumn })}
      />
      <ActionButton
        icon={<IconLeftNarrow />}
        label={t("columns.sidebarLeft")}
        active={layout === ColumnLayout.SidebarLeft}
        onClick={() => updateAttributes({ layout: ColumnLayout.SidebarLeft })}
      />
      <ActionButton
        icon={<IconRightNarrow />}
        label={t("columns.sidebarRight")}
        active={layout === ColumnLayout.SidebarRight}
        onClick={() => updateAttributes({ layout: ColumnLayout.SidebarRight })}
      />
    </>
  );
}
