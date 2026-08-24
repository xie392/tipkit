"use client";

import { useState } from "react";
import { ImagePreview } from "@tipkit/extensions";
import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import {
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconImage,
  IconLink,
  IconCaption,
  IconWidth,
  IconZoomIn,
} from "./icons";
import { ActionDropdown, ActionButton, ActionMenuItem } from "./shared";

const WIDTH_OPTIONS = [
  { value: "25%", label: "25%" },
  { value: "50%", label: "50%" },
  { value: "75%", label: "75%" },
  { value: "100%", label: "100%" },
];

type Align = "left" | "center" | "right";

export function ImageBlockActions({ node, updateAttributes }: BlockActionProps) {
  const t = useT();
  const attrs = node.attrs as {
    width: string;
    align: Align;
    alt?: string;
    caption?: string | null;
    src: string;
  };

  const [preview, setPreview] = useState(false);

  const currentWidth = attrs.width || "100%";
  const align = attrs.align || "center";

  const setAlign = (a: Align) => updateAttributes({ align: a });

  const replaceImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        updateAttributes({ src: reader.result as string });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const editLink = () => {
    const url = window.prompt(t("image.linkPrompt"), attrs.src || "");
    if (url != null) {
      updateAttributes({ src: url.trim() });
    }
  };

  const toggleCaption = () => {
    updateAttributes({ caption: attrs.caption != null ? null : "" });
  };

  return (
    <>
      <ActionDropdown icon={<IconWidth />} label={t("image.width")}>
        {(close) =>
          WIDTH_OPTIONS.map((opt) => (
            <ActionMenuItem
              key={opt.value}
              active={currentWidth === opt.value}
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

      <ActionButton
        icon={<IconAlignLeft />}
        label={t("image.alignLeft")}
        active={align === "left"}
        onClick={() => setAlign("left")}
      />
      <ActionButton
        icon={<IconAlignCenter />}
        label={t("image.alignCenter")}
        active={align === "center"}
        onClick={() => setAlign("center")}
      />
      <ActionButton
        icon={<IconAlignRight />}
        label={t("image.alignRight")}
        active={align === "right"}
        onClick={() => setAlign("right")}
      />

      <ActionButton icon={<IconImage />} label={t("image.replace")} onClick={replaceImage} />
      <ActionButton icon={<IconLink />} label={t("image.editLink")} onClick={editLink} />
      <ActionButton
        icon={<IconCaption />}
        label={attrs.caption != null ? t("image.removeCaption") : t("image.addCaption")}
        active={attrs.caption != null}
        onClick={toggleCaption}
      />
      <ActionButton icon={<IconZoomIn />} label={t("image.preview")} onClick={() => setPreview(true)} />

      {preview && (
        <ImagePreview src={attrs.src} alt={attrs.alt} onClose={() => setPreview(false)} />
      )}
    </>
  );
}
