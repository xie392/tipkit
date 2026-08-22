"use client";

import type { BlockActionProps } from "./types";
import { IconColumns } from "./icons";
import { ActionDropdown, ActionMenuItem } from "./shared";

const LAYOUTS = [
  { value: "two-column", label: "两栏等宽", icon: "▥" },
  { value: "sidebar-left", label: "左窄右宽", icon: "◧" },
  { value: "sidebar-right", label: "右窄左宽", icon: "◨" },
] as const;

export function ColumnsActions({ node, updateAttributes }: BlockActionProps) {
  const layout = (node.attrs.layout as string) ?? "two-column";

  return (
    <ActionDropdown icon={<IconColumns />} label="分栏布局" width={150}>
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
            <span>{l.label}</span>
          </ActionMenuItem>
        ))
      }
    </ActionDropdown>
  );
}
