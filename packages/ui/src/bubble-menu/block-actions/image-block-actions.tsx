"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

function PreviewOverlay({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="tk-image-preview-overlay" onMouseDown={onClose} role="dialog" aria-modal="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        className="tk-image-preview-img"
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

export function ImageBlockActions({ node, updateAttributes }: BlockActionProps) {
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
    const url = window.prompt("输入图片链接", attrs.src || "");
    if (url != null) {
      updateAttributes({ src: url.trim() });
    }
  };

  const toggleCaption = () => {
    updateAttributes({ caption: attrs.caption != null ? null : "" });
  };

  return (
    <>
      <ActionDropdown icon={<IconWidth />} label="宽度">
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
        label="左对齐"
        active={align === "left"}
        onClick={() => setAlign("left")}
      />
      <ActionButton
        icon={<IconAlignCenter />}
        label="居中"
        active={align === "center"}
        onClick={() => setAlign("center")}
      />
      <ActionButton
        icon={<IconAlignRight />}
        label="右对齐"
        active={align === "right"}
        onClick={() => setAlign("right")}
      />

      <ActionButton icon={<IconImage />} label="替换图片" onClick={replaceImage} />
      <ActionButton icon={<IconLink />} label="图片链接" onClick={editLink} />
      <ActionButton
        icon={<IconCaption />}
        label={attrs.caption != null ? "移除说明" : "添加说明"}
        active={attrs.caption != null}
        onClick={toggleCaption}
      />
      <ActionButton icon={<IconZoomIn />} label="预览图片" onClick={() => setPreview(true)} />

      {preview && (
        <PreviewOverlay src={attrs.src} alt={attrs.alt} onClose={() => setPreview(false)} />
      )}
    </>
  );
}
