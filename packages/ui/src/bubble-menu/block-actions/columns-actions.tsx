"use client";

import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import { IconColumns } from "./icons";
import { ActionDropdown, ActionMenuItem } from "./shared";

const LAYOUTS = [
  { value: "two-column", labelKey: "columns.twoColumn", icon: "▥" },
  { value: "sidebar-left", labelKey: "columns.sidebarLeft", icon: "◧" },
  { value: "sidebar-right", labelKey: "columns.sidebarRight", icon: "◨" },
] as const;

export function ColumnsActions({ node, updateAttributes }: BlockActionProps) {
  const t = useT();
  const layout = (node.attrs.layout as string) ?? "two-column";

  return (
    <ActionDropdown icon={<IconColumns />} label={t("columns.layout")} width={150}>
      {(close) =>
        LAYOUTS.map((l) => (
          <ActionMenuItem
            key={l.value}
            active={layout === l.value}
            onClick={() => {
              updateAttributes({ layout: l.value });
              close();
            }}
          >
            <span className="tk-block-action-item-icon">{l.icon}</span>
            <span>{t(l.labelKey)}</span>
          </ActionMenuItem>
        ))
      }
    </ActionDropdown>
  );
}
