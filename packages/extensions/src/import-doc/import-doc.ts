import { Extension, type Editor, type RawCommands } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    importDoc: {
      /**
       * 导入一个文档文件（如 .docx / .pdf）并替换编辑器内容。
       * 转换由消费方注入的 onConvert 完成（前端 mammoth 或服务端 pandoc 等），
       * 返回 HTML 字符串；未配置 onConvert 或转换失败时命令返回 false。
       */
      // 异步命令：返回类型写具体 Promise，不走 Commands<ReturnType> 泛型（该泛型是同步 boolean）
      importDocument: (file: File) => Promise<boolean>;
    };
  }
}

export interface ImportDocOptions {
  /** 允许触发导入的 MIME 类型（用于消费方做入口过滤提示） */
  allowedMimeTypes: string[];
  /**
   * 将文件转换为 HTML。由消费方注入（可调用自身服务端转换接口）。
   * 返回 null 表示转换失败（文件损坏 / 格式不支持等）。
   */
  onConvert?: (file: File) => Promise<string | null>;
}

export const ImportDoc = Extension.create<ImportDocOptions>({
  name: "importDoc",

  addOptions() {
    return {
      allowedMimeTypes: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/pdf",
      ],
      onConvert: undefined,
    };
  },

  addCommands() {
    // RawCommands 类型层要求同步 boolean；本命令是异步的，用具体 Promise
    // 签名声明（见上方 declare module），此处对其收窄 cast。
    const importDocument =
      (file: File) =>
      ({ editor }: { editor: Editor }) => {
        const { onConvert, allowedMimeTypes } = this.options;
        if (file.type && !allowedMimeTypes.includes(file.type)) {
          console.warn(`[TipKit] ImportDoc 不支持的文件类型：${file.type}`);
          return Promise.resolve(false);
        }
        if (!onConvert) {
          console.warn(
            "[TipKit] ImportDoc 未配置 onConvert，无法导入。请通过 ImportDoc.configure({ onConvert }) 注入转换函数。",
          );
          return Promise.resolve(false);
        }
        return onConvert(file)
          .then((html) => {
            if (!html) return false;
            return editor.chain().setContent(html, { emitUpdate: true }).run();
          })
          .catch((error) => {
            console.error("[TipKit] ImportDoc 转换失败：", error);
            return false;
          });
      };

    return { importDocument } as unknown as Partial<RawCommands>;
  },
});
