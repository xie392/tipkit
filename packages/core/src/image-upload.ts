import type { Editor } from "@tiptap/core";

/* 图片上传占位的通用收尾逻辑：file-handler（粘贴/拖拽）与 SlashMenu
 * 都先插入带 uploadId 的 imageBlock 占位节点，上传结束后调用本函数落盘。 */

/** 生成 uploadId（占位节点与上传任务的关联标识） */
export function createUploadId(): string {
  return `tk-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 按 uploadId 查找上传中的 imageBlock 节点：
 * - url 非空：写入正式地址并清除上传态
 * - url 为 null（失败/取消）：删除占位节点
 */
export function finalizeImageUpload(editor: Editor, uploadId: string, url: string | null): boolean {
  let target: { pos: number; size: number; attrs: Record<string, unknown> } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (target) return false;
    if (node.type.name === "imageBlock" && node.attrs.uploadId === uploadId) {
      target = { pos, size: node.nodeSize, attrs: node.attrs as Record<string, unknown> };
      return false;
    }
    return true;
  });
  if (!target) return false;
  // 快照：target 在闭包内赋值，TS 不保留其收窄，先拷出再解构
  const snapshot = target as { pos: number; size: number; attrs: Record<string, unknown> };
  const { pos, size, attrs } = snapshot;

  const tr = editor.state.tr;
  if (url) {
    tr.setNodeMarkup(pos, undefined, {
      ...attrs,
      src: url,
      uploading: false,
      uploadId: null,
    });
  } else {
    tr.delete(pos, pos + size);
  }
  editor.view.dispatch(tr);
  return true;
}
