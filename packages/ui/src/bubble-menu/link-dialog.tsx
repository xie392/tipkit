"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import { Link } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from "@tipkit/components";
import { useT } from "@tipkit/core";

interface LinkDialogProps {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
  const t = useT();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open || !editor) return;

    const { from, to, empty } = editor.state.selection;
    let selectedText = empty ? "" : editor.state.doc.textBetween(from, to, "\n", " ");
    if (!selectedText && editor.isActive("link")) {
      const range = getMarkRange(
        editor.state.doc.resolve(editor.state.selection.from),
        editor.schema.marks.link,
      );
      if (range) {
        selectedText = editor.state.doc.textBetween(range.from, range.to, "\n", " ");
      }
    }
    setText(selectedText);
    setUrl((editor.getAttributes("link").href as string) ?? "");
  }, [editor, open]);

  const applyLink = () => {
    if (!editor) return;
    const href = url.trim();
    const label = text.trim() || href || t("link.defaultText");
    const { from, to, empty } = editor.state.selection;

    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onOpenChange(false);
      return;
    }

    const chain = editor.chain().focus();

    if (empty) {
      chain.insertContent({
        type: "text",
        text: label,
        marks: [{ type: "link", attrs: { href } }],
      });
    } else {
      const selectedText = editor.state.doc.textBetween(from, to, "\n", " ");
      if (text.trim() && text.trim() !== selectedText) {
        chain.deleteRange({ from, to }).insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href } }],
        });
      } else {
        chain.extendMarkRange("link").setLink({ href });
      }
    }
    chain.run();
    onOpenChange(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tk-link-dialog tk-max-w-sm">
        <DialogHeader>
          <DialogTitle className="tk-dialog-title-row">
            <Link className="tk-icon-md tk-dialog-title-icon" />
            {t("link.editTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="tk-link-dialog-body">
          <div className="tk-link-field">
            <label htmlFor="tk-link-text" className="tk-link-label">
              {t("link.textLabel")}
            </label>
            <Input
              id="tk-link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("link.textPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
          <div className="tk-link-field">
            <label htmlFor="tk-link-url" className="tk-link-label">
              {t("link.urlLabel")}
            </label>
            <Input
              id="tk-link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="tk-link-dialog-footer">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("link.cancel")}
          </Button>
          <Button type="button" variant="outline" onClick={removeLink}>
            {t("link.remove")}
          </Button>
          <Button type="button" onClick={applyLink}>
            {t("link.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

let requestOpen: (() => void) | null = null;

export function openLinkDialog() {
  requestOpen?.();
}

export function LinkDialogHost({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestOpen = () => setOpen(true);
    return () => {
      requestOpen = null;
    };
  }, []);

  return <LinkDialog editor={editor} open={open} onOpenChange={setOpen} />;
}
