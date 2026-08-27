"use client";

import { useRef, useState } from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useEditorDeps, useEditorEditable, useT, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";

/* Attachment 附件（迁移自 blog rich-text/ext/attachment.tsx）。
 * 上传经 EditorDeps.uploadAttachment 注入（返回 AttachmentMeta），
 * 与 blog 的 tRPC 上传解耦。 */

export interface AttachmentAttrs {
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  fileExt: string | null;
  url: string | null;
  hasTrigger: boolean;
  error: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachment: {
      setAttachment: (attrs?: Partial<AttachmentAttrs>) => ReturnType;
    };
  }
}

function normalizeFileSize(bytes: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtOf(name: string | null): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : null;
}

function stripFileExt(name: string | null): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(0, idx) : name;
}

export const Attachment = Node.create({
  name: "attachment",
  content: "",
  marks: "",
  group: "block",
  selectable: true,
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-attachment" } };
  },

  addAttributes() {
    return {
      fileName: {
        default: null,
        parseHTML: (el) => stripFileExt((el as HTMLElement).getAttribute("data-filename")),
        renderHTML: (a) => (a.fileName ? { "data-filename": a.fileName } : {}),
      },
      fileSize: {
        default: null,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute("data-filesize")) || null,
        renderHTML: (a) => (a.fileSize ? { "data-filesize": String(a.fileSize) } : {}),
      },
      fileType: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-filetype") ?? null,
        renderHTML: (a) => (a.fileType ? { "data-filetype": a.fileType } : {}),
      },
      fileExt: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-fileext") ?? null,
        renderHTML: (a) => (a.fileExt ? { "data-fileext": a.fileExt } : {}),
      },
      url: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-url") ?? null,
        renderHTML: (a) => (a.url ? { "data-url": a.url } : {}),
      },
      hasTrigger: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-has-trigger") === "true",
        renderHTML: () => ({}),
      },
      error: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-attachment" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const fileName = (attrs["data-filename"] as string) || "";
    const fileSize = Number(attrs["data-filesize"]) || null;
    const fileExt = (attrs["data-fileext"] as string) || null;
    const url = (attrs["data-url"] as string) || "";
    const baseAttrs = mergeAttributes(this.options.HTMLAttributes, {
      "data-filename": fileName,
      "data-filesize": attrs["data-filesize"] ?? "",
      "data-filetype": attrs["data-filetype"] ?? "",
      "data-fileext": fileExt ?? "",
      "data-url": url,
    });
    if (!url) return ["div", baseAttrs];
    const displayName = fileName && fileExt ? `${fileName}.${fileExt}` : fileName || "未命名文件";
    const sizeText = normalizeFileSize(fileSize);
    return [
      "div",
      baseAttrs,
      [
        "a",
        {
          class: "tk-att-card",
          href: url,
          target: "_blank",
          rel: "noopener noreferrer",
          download: displayName,
        },
        ["div", { class: "tk-att-meta" }, ["div", { class: "tk-att-name" }, displayName], ["div", { class: "tk-att-size" }, sizeText]],
        ["div", { class: "tk-att-actions" }, ["span", { class: "tk-att-btn" }, "下载"]],
      ],
    ];
  },

  addCommands() {
    return {
      setAttachment:
        (attrs) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({ type: "attachment", attrs: { ...attrs } })
            .run(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },
});

function AttachmentView(props: NodeViewProps) {
  const { editor, node, updateAttributes, selected } = props;
  const attrs = node.attrs as AttachmentAttrs;
  const { fileName, fileSize, fileExt, url } = attrs;
  const isEditable = useEditorEditable(editor);
  const deps = useEditorDeps();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(rootRef);
  const { visible, show, hide } = useToolbarVisibility();
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const selectFile = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!deps.uploadAttachment) {
      setErrMsg("未注入 uploadAttachment，请在 EditorDeps 中提供");
      return;
    }
    try {
      setProgress(0);
      setErrMsg(null);
      // 注入函数负责上传；demo 可模拟进度
      const meta = await deps.uploadAttachment(file, editor);
      setProgress(null);
      updateAttributes({
        fileName: meta.name.replace(/\.[^/.]+$/, ""),
        fileSize: meta.size,
        fileType: meta.mimeType,
        fileExt: fileExtOf(meta.name) ?? meta.name.split(".").pop() ?? null,
        url: meta.url,
        hasTrigger: true,
        error: null,
      });
    } catch (err) {
      setProgress(null);
      setErrMsg(err instanceof Error ? err.message : t("attachmentView.uploadFailed"));
      updateAttributes({ error: String(err) });
    }
  };

  const triggerDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = fileName ?? "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDuplicate = () => {
    const pos = props.getPos();
    if (typeof pos !== "number") return;
    props.editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(pos + props.node.nodeSize, props.node.toJSON())
      .run();
  };

  const displayName = fileName && fileExt ? `${fileName}.${fileExt}` : fileName ?? t("attachmentView.unnamed");

  let content: React.ReactNode;
  if (url) {
    content = (
      <div className="tk-att-card" onClick={isEditable ? undefined : triggerDownload}>
        <div className="tk-att-meta">
          <div className="tk-att-name" title={displayName}>
            {displayName}
          </div>
          <div className="tk-att-size">{normalizeFileSize(fileSize)}</div>
        </div>
        <div className="tk-att-actions">
          <button
            type="button"
            title="下载"
            onMouseDown={(e) => e.preventDefault()}
            onClick={triggerDownload}
            className="tk-att-btn"
          >
            下载
          </button>
        </div>
      </div>
    );
  } else if (progress !== null) {
    content = (
      <div className="tk-att-uploading">
        <span className="tk-att-spinner" aria-hidden="true" />
        <span>上传中… {progress}%</span>
      </div>
    );
  } else if (errMsg) {
    content = (
      <div className="tk-att-error" onClick={selectFile}>
        <span>{errMsg}</span>
        <span className="tk-att-retry">点击重试</span>
      </div>
    );
  } else {
    content = (
      <div className="tk-att-empty" onClick={selectFile}>
        <span className="tk-att-empty-icon" aria-hidden="true">
          ＋
        </span>
        <span>点击上传附件</span>
        <span className="tk-att-empty-hint">支持 PDF / Office / 图片 / 压缩包等</span>
      </div>
    );
  }

  function IconUpload() {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 11V3M5 5.5L8 3l3 2.5" />
        <path d="M2.5 10v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
      </svg>
    );
  }
  function IconDownload() {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3v8M5 7.5L8 11l3-3.5" />
        <path d="M2.5 10v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
      </svg>
    );
  }
  function IconCopy() {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
        <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
      </svg>
    );
  }
  function IconTrash() {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
      </svg>
    );
  }

  return (
    <NodeViewWrapper
      ref={rootRef}
      className={`tk-attachment tk-hover-toolbar${isEditable ? " is-editable" : ""}${hovered ? " is-hovered" : ""}${selected ? " is-selected" : ""}`}
      data-has-url={url ? "true" : "false"}
      onMouseEnter={() => {
        if (isEditable) setHovered(true);
        show();
      }}
      onMouseLeave={() => {
        setHovered(false);
        hide();
      }}
    >
      {isEditable && url && (
        <div
          className={`tk-ct-toolbar-bridge ${placement === "bottom" ? "is-bottom" : "is-top"}${visible ? " is-visible" : ""}`}
          contentEditable={false}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="tk-ct-toolbar">
            <button
              type="button"
              className="tk-ct-btn"
              data-tip={t("attachment.reupload")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectFile}
            >
              <IconUpload />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              className="tk-ct-btn"
              data-tip={t("attachment.download")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={triggerDownload}
            >
              <IconDownload />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              className="tk-ct-btn"
              data-tip={t("block.duplicate")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDuplicate}
            >
              <IconCopy />
            </button>
            <span className="tk-ct-sep" />
            <button
              type="button"
              className="tk-ct-btn"
              data-tip={t("block.delete")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => props.deleteNode()}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
      {content}
      <input ref={inputRef} type="file" className="tk-hidden" onChange={handleFile} />
    </NodeViewWrapper>
  );
}

export default Attachment;
