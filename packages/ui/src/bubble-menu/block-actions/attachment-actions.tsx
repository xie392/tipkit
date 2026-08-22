"use client";

import type { BlockActionProps } from "./types";
import { IconUpload, IconDownload, IconEdit } from "./icons";
import { ActionButton } from "./shared";

export function AttachmentActions({ node, updateAttributes }: BlockActionProps) {
  const attrs = node.attrs as {
    fileName: string | null;
    url: string | null;
  };

  const reupload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const nameParts = file.name.split(".");
        const ext = nameParts.length > 1 ? nameParts.pop()! : null;
        const baseName = nameParts.join(".");
        updateAttributes({
          url: reader.result as string,
          fileName: baseName,
          fileExt: ext?.toLowerCase() ?? null,
          fileSize: file.size,
          fileType: file.type,
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const download = () => {
    if (!attrs.url) return;
    const a = document.createElement("a");
    a.href = attrs.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = attrs.fileName ?? "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const rename = () => {
    const next = window.prompt("输入文件名（不含扩展名）", attrs.fileName ?? "");
    if (next != null) {
      updateAttributes({ fileName: next.trim() || null });
    }
  };

  return (
    <>
      <ActionButton icon={<IconUpload />} label="重新上传" onClick={reupload} />
      <ActionButton icon={<IconDownload />} label="下载" onClick={download} />
      <ActionButton icon={<IconEdit />} label="重命名" onClick={rename} />
    </>
  );
}
