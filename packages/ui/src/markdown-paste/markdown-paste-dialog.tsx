"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@tipkit/components";
import { useT } from "@tipkit/core";
import type { MarkdownPasteActions } from "@tipkit/extensions";

/* Markdown 粘贴确认弹窗（布局层；视觉走 shadcn CSS 变量 + themes）。
 * 用法：消费方在 MarkdownPaste.configure({ onMarkdownDetected }) 回调里调
 * openMarkdownPasteConfirm(text, actions)，并挂载 <MarkdownPasteConfirmHost />。
 * 关闭弹窗（Esc / 遮罩 / X）视为保留原文本。 */

type ConfirmRequest = {
  text: string;
  actions: MarkdownPasteActions;
  /** 未做选择就关闭弹窗时的兜底动作 */
  settle: (action: "convert" | "plain") => void;
};

let requestConfirm: ((req: ConfirmRequest) => void) | null = null;

export function openMarkdownPasteConfirm(text: string, actions: MarkdownPasteActions) {
  let settled = false;
  requestConfirm?.({
    text,
    actions,
    settle: (action) => {
      if (settled) return;
      settled = true;
      if (action === "convert") actions.convert();
      else actions.insertPlain();
    },
  });
}

export function MarkdownPasteConfirmHost() {
  const t = useT();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const reqRef = useRef<ConfirmRequest | null>(null);

  useEffect(() => {
    requestConfirm = (next) => {
      reqRef.current = next;
      setReq(next);
    };
    return () => {
      requestConfirm = null;
    };
  }, []);

  const close = (action: "convert" | "plain") => {
    req?.settle(action);
    reqRef.current = null;
    setReq(null);
  };

  const preview = req?.text.replace(/\s+/g, " ").trim().slice(0, 160) ?? "";

  return (
    <Dialog
      open={!!req}
      onOpenChange={(open) => {
        if (!open) close("plain");
      }}
    >
      <DialogContent className="tk-markdown-paste-dialog tk-max-w-sm">
        <DialogHeader>
          <DialogTitle className="tk-dialog-title-row">
            <FileText className="tk-icon-md tk-dialog-title-icon" />
            {t("markdownPaste.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="tk-markdown-paste-body">
          <p className="tk-markdown-paste-description">{t("markdownPaste.description")}</p>
          {preview && <div className="tk-markdown-paste-preview">{preview}…</div>}
        </div>
        <DialogFooter className="tk-link-dialog-footer">
          <Button type="button" variant="outline" onClick={() => close("plain")}>
            {t("markdownPaste.keepPlain")}
          </Button>
          <Button type="button" onClick={() => close("convert")}>
            {t("markdownPaste.convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
