"use client";

import { useEffect, useState } from "react";
import type { BlockActionProps } from "./types";
import { IconUpload, IconDownload, IconEdit } from "./icons";
import { ActionButton } from "./shared";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from "@tipkit/components";

export function AttachmentActions({ node, updateAttributes }: BlockActionProps) {
  const attrs = node.attrs as {
    fileName: string | null;
    url: string | null;
  };

  const [renameOpen, setRenameOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");

  useEffect(() => {
    if (renameOpen) setNameValue(attrs.fileName ?? "");
  }, [renameOpen, attrs.fileName]);

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

  const openRename = () => setRenameOpen(true);

  const confirmRename = () => {
    updateAttributes({ fileName: nameValue.trim() || null });
    setRenameOpen(false);
  };

  return (
    <>
      <ActionButton icon={<IconUpload />} label="重新上传" onClick={reupload} />
      <ActionButton icon={<IconDownload />} label="下载" onClick={download} />
      <ActionButton icon={<IconEdit />} label="重命名" onClick={openRename} />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="tk-rename-dialog tk-max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="tk-rename-dialog-body">
            <div className="tk-rename-field">
              <label htmlFor="tk-rename-input" className="tk-rename-label">
                文件名（不含扩展名）
              </label>
              <Input
                id="tk-rename-input"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="请输入文件名"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="tk-rename-dialog-footer">
            <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={confirmRename}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
