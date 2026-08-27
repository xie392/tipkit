"use client";

import { useT } from "@tipkit/core";
import type { BlockActionProps } from "./types";
import { IconEdit, IconCopy, IconFormula } from "./icons";
import { ActionButton } from "./shared";

export function KatexActions({ node, editor, pos }: BlockActionProps) {
  const t = useT();
  const text = (node.attrs.text as string) ?? "";

  const openEditor = () => {
    // 通过自定义事件通知 katex NodeView 打开编辑器（避免跨包直接调用 React state）
    const domAt = editor.view.domAtPos(pos + 1);
    const node = (domAt.node as HTMLElement)?.nodeType === 1
      ? (domAt.node as HTMLElement)
      : (domAt.node?.parentElement as HTMLElement | null);
    const katexEl = node?.closest?.(".tk-katex") as HTMLElement | null;
    katexEl?.dispatchEvent(new Event("tk-katex:open-editor", { bubbles: true }));
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
      <ActionButton icon={<IconFormula />} label={t("katex.formula")} active onClick={openEditor} />
      <ActionButton icon={<IconEdit />} label={t("katex.edit")} onClick={openEditor} />
      <ActionButton icon={<IconCopy />} label={t("katex.copySource")} onClick={copySource} />
    </>
  );
}
