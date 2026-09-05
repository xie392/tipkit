"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tipkit/components";
import { useDemoLang } from "@/components/use-demo-lang";
import { exportMarkdown, exportPdf, exportPdfServer, exportWord } from "@/lib/export-document";
import { FileDown, FileText, FileType, Loader2, Printer } from "lucide-react";

/* 右下角悬浮「导出」按钮（与编辑/只读开关并排）：Markdown / Word / PDF */
export function ExportFab({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useDemoLang();

  const run = async (fn: () => void | Promise<void>) => {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (!editor) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="demo-mode-toggle demo-export-toggle"
          aria-label={t("toolbar.export")}
          disabled={busy}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          <span>{t("toolbar.export")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-48">
        <DropdownMenuItem onClick={() => run(() => exportMarkdown(editor))}>
          <FileText className="w-4 h-4" />
          {t("toolbar.exportMarkdown")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => exportWord(editor))}>
          <FileType className="w-4 h-4" />
          {t("toolbar.exportWord")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => exportPdf(editor))}>
          <Printer className="w-4 h-4" />
          {t("toolbar.exportPdf")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => exportPdfServer(editor))}>
          <FileDown className="w-4 h-4" />
          {t("toolbar.exportPdfServer")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
