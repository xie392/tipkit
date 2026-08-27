"use client";

import { useCallback, useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEditorEditable, useT } from "@tipkit/core";
import { openStatusPopover, type StatusPopoverAttrs } from "./status-popover";

/* Status 的 React NodeView：
 * 以内联 span 展示彩色状态标签；可编辑态下点击弹出原生 DOM 编辑面板
 * （status-popover.ts），面板内可改文字 / 换颜色 / 删除该标签。 */

export function StatusView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const attrs = node.attrs as StatusPopoverAttrs;
  const isEditable = useEditorEditable(props.editor);
  const t = useT();
  const wrapperRef = useRef<HTMLElement | null>(null);
  const closePopoverRef = useRef<(() => void) | null>(null);

  // 组件卸载（如删除节点）时兜底关闭弹层
  useEffect(() => {
    return () => {
      closePopoverRef.current?.();
    };
  }, []);

  const openPopover = useCallback(() => {
    if (!isEditable) return;
    const el = wrapperRef.current;
    if (!el) return;
    closePopoverRef.current?.();
    closePopoverRef.current = openStatusPopover({
      anchor: el,
      text: attrs.text,
      color: attrs.color,
      editable: isEditable,
      onSave: (next) => updateAttributes(next),
      onDelete: () => deleteNode(),
      onClose: () => {
        closePopoverRef.current = null;
      },
      labels: {
        textPlaceholder: t("status.textPlaceholder"),
        selectColor: t("status.selectColor"),
        delete: t("status.delete"),
      },
    });
  }, [isEditable, attrs.text, attrs.color, updateAttributes, deleteNode, t]);

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`tk-status${selected ? " is-selected" : ""}`}
      style={{ backgroundColor: attrs.color }}
      contentEditable={false}
      data-status="true"
      onClick={openPopover}
    >
      {attrs.text}
    </NodeViewWrapper>
  );
}
