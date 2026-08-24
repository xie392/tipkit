"use client";

import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import { IconEdit, IconExternal, IconWidth } from "./icons";
import { ActionDropdown, ActionButton, ActionMenuItem } from "./shared";

const WIDTH_OPTIONS = [
  { value: "50%", label: "50%" },
  { value: "75%", label: "75%" },
  { value: "100%", label: "100%" },
];

export function IframeActions({ node, updateAttributes }: BlockActionProps) {
  const t = useT();
  const attrs = node.attrs as { url: string | null; width: string; height: number };

  const editUrl = () => {
    const url = window.prompt(t("iframe.linkPrompt"), attrs.url ?? "");
    if (url != null) {
      updateAttributes({ url: url.trim() || null });
    }
  };

  const openExternal = () => {
    if (attrs.url) window.open(attrs.url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <ActionButton icon={<IconEdit />} label={t("iframe.editLink")} onClick={editUrl} />

      <ActionDropdown icon={<IconWidth />} label={t("iframe.width")}>
        {(close) =>
          WIDTH_OPTIONS.map((opt) => (
            <ActionMenuItem
              key={opt.value}
              active={attrs.width === opt.value}
              onClick={() => {
                updateAttributes({ width: opt.value });
                close();
              }}
            >
              {opt.label}
            </ActionMenuItem>
          ))
        }
      </ActionDropdown>

      <ActionButton icon={<IconExternal />} label={t("iframe.openExternal")} onClick={openExternal} />
    </>
  );
}
