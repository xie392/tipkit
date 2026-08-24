"use client";

import { useEffect, useState } from "react";
import { useT } from "@tipkit/core";
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
  const t = useT();
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
      <ActionButton icon={<IconUpload />} label={t("attachment.reupload")} onClick={reupload} />
      <ActionButton icon={<IconDownload />} label={t("attachment.download")} onClick={download} />
      <ActionButton icon={<IconEdit />} label={t("attachment.rename")} onClick={openRename} />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="tk-rename-dialog tk-max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("attachment.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="tk-rename-dialog-body">
            <div className="tk-rename-field">
              <label htmlFor="tk-rename-input" className="tk-rename-label">
                {t("attachment.renameLabel")}
              </label>
              <Input
                id="tk-rename-input"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder={t("attachment.renamePlaceholder")}
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
              {t("attachment.renameCancel")}
            </Button>
            <Button type="button" onClick={confirmRename}>
              {t("attachment.renameConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
