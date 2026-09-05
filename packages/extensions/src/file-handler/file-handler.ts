import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { createUploadId, finalizeImageUpload } from "@tipkit/core";

/* 文件拖拽/粘贴处理（迁移自 blog rich-text/ext/file-handler.ts）。
 * 图片拖入或粘贴自动上传并插入；上传函数由配置注入（EditorDeps.uploadImage）。
 * 配置了上传时先插入占位节点（本地 blob 预览 + loading 遮罩），完成后替换 src。 */

export interface FileHandlerOptions {
  allowedMimeTypes: string[];
  /** 上传单个文件，返回图片 URL；失败返回 null */
  onUpload?: (file: File) => Promise<string | null>;
  /** 插入图片的回调（默认插入 imageBlock） */
  onInsertImage?: (editor: Editor, src: string, pos?: number) => void;
}

export const FileHandler = Extension.create<FileHandlerOptions>({
  name: "fileHandler",

  addOptions() {
    return {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      onUpload: undefined,
      onInsertImage: undefined,
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    const editor = this.editor;

    const insertImage = (src: string, pos?: number) => {
      if (opts.onInsertImage) {
        opts.onInsertImage(editor, src, pos);
        return;
      }
      const chain = editor.chain().focus();
      if (typeof pos === "number") {
        chain.setImageBlockAt({ src, pos }).run();
      } else {
        chain.setImageBlock({ src }).run();
      }
    };

    const handleFile = (file: File, pos?: number) => {
      if (!opts.allowedMimeTypes.includes(file.type)) return;
      if (!opts.onUpload) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") insertImage(reader.result, pos);
        };
        reader.readAsDataURL(file);
        return;
      }
      // 先插入占位节点（本地 blob 预览 + 上传中遮罩），上传结束后落盘或移除
      const uploadId = createUploadId();
      const previewUrl = URL.createObjectURL(file);
      const attrs = { src: previewUrl, uploading: true, uploadId };
      const chain = editor.chain().focus(undefined, { scrollIntoView: false });
      if (typeof pos === "number") {
        chain.setImageBlockAt({ pos, ...attrs }).run();
      } else {
        chain.setImageBlock(attrs).run();
      }
      opts
        .onUpload(file)
        .then((url) => {
          finalizeImageUpload(editor, uploadId, url);
        })
        .catch(() => {
          finalizeImageUpload(editor, uploadId, null);
        })
        .finally(() => {
          URL.revokeObjectURL(previewUrl);
        });
    };

    const pluginKey = new PluginKey("fileHandler");

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleDrop: (view: EditorView, event: DragEvent) => {
            const files = event.dataTransfer?.files;
            if (!files || !files.length) return false;
            const list = Array.from(files);
            if (!list.some((f) => opts.allowedMimeTypes.includes(f.type))) return false;
            event.preventDefault();
            const dropPos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            list.forEach((file) => handleFile(file, dropPos?.pos));
            return true;
          },
          handlePaste: (_view: EditorView, event: ClipboardEvent) => {
            const files = event.clipboardData?.files;
            if (!files || !files.length) return false;
            const list = Array.from(files);
            if (!list.some((f) => opts.allowedMimeTypes.includes(f.type))) return false;
            event.preventDefault();
            list.forEach((file) => handleFile(file));
            return true;
          },
        },
      }),
    ];
  },
});
