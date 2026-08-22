"use client";

import type { BlockActionProps } from "./types";
import { IconEdit, IconCopy, IconFormula } from "./icons";
import { ActionButton } from "./shared";

export function KatexActions({ node, editor, pos }: BlockActionProps) {
  const text = (node.attrs.text as string) ?? "";

  const editFormula = () => {
    const el = editor.view.domAtPos(pos + 1).node as HTMLElement;
    const katexEl = el?.closest?.(".tk-katex") ?? el?.parentElement;
    const display = katexEl?.querySelector?.(".tk-katex-display") as HTMLElement | null;
    if (display) {
      display.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <ActionButton icon={<IconFormula />} label="公式" active onClick={editFormula} />
      <ActionButton icon={<IconEdit />} label="编辑公式" onClick={editFormula} />
      <ActionButton icon={<IconCopy />} label="复制 LaTeX 源码" onClick={copySource} />
    </>
  );
}
