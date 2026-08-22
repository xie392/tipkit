"use client";

import type { BlockActionProps } from "./types";
import { IconEdit, IconExternal, IconWidth } from "./icons";
import { ActionDropdown, ActionButton, ActionMenuItem } from "./shared";

const WIDTH_OPTIONS = [
  { value: "50%", label: "50%" },
  { value: "75%", label: "75%" },
  { value: "100%", label: "100%" },
];

export function IframeActions({ node, updateAttributes }: BlockActionProps) {
  const attrs = node.attrs as { url: string | null; width: string; height: number };

  const editUrl = () => {
    const url = window.prompt("输入嵌入链接", attrs.url ?? "");
    if (url != null) {
      updateAttributes({ url: url.trim() || null });
    }
  };

  const openExternal = () => {
    if (attrs.url) window.open(attrs.url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <ActionButton icon={<IconEdit />} label="编辑链接" onClick={editUrl} />

      <ActionDropdown icon={<IconWidth />} label="宽度">
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

      <ActionButton icon={<IconExternal />} label="新窗口打开" onClick={openExternal} />
    </>
  );
}
