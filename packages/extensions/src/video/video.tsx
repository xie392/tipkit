"use client";

import { useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useEditorDeps, useEditorEditable, useToolbarPlacement, useToolbarVisibility } from "@tipkit/core";

/* Video 视频块（借鉴 yiitap 的 video 节点：https://github.com/pileax-ai/yiitap，MIT）。
 * 支持两种来源：直接视频链接（mp4/webm/ogg）或经 EditorDeps.uploadAttachment 上传。
 * 渲染 <video controls>，交互风格与 attachment 一致（空态卡片 / 上传中 / 失败重试）。 */

export interface VideoAttrs {
  src: string | null;
  error: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (attrs?: Partial<VideoAttrs>) => ReturnType;
    };
  }
}

const VIDEO_MIME_PREFIX = "video/";
const VIDEO_EXT_RE = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;

function isVideoFile(file: File) {
  return file.type.startsWith(VIDEO_MIME_PREFIX) || VIDEO_EXT_RE.test(file.name);
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5l3-3M5 11l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4L3.5 5.7a2.4 2.4 0 0 1 3.4 0M11 5l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4l-3.1 3.1a2.4 2.4 0 0 1-3.4 0" transform="translate(-1 -1)" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10.5V2.5M4.8 5.7 8 2.5l3.2 3.2M2.5 13.5h11" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="tk-video-spinner">
      <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8" />
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

export const Video = Node.create({
  name: "video",
  content: "",
  marks: "",
  group: "block",
  selectable: true,
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-video" } };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-src"),
        renderHTML: (a) => (a.src ? { "data-src": a.src } : {}),
      },
      error: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "div[data-type='video']" },
      { tag: "video[src]", getAttrs: (el) => ({ src: (el as HTMLVideoElement).getAttribute("src") }) },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes as Record<string, unknown>)["data-src"] as string | null;
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-type": "video" }),
      src ? ["video", { src, controls: true, preload: "metadata" }] : ["div", { class: "tk-video-empty" }],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs?: Partial<VideoAttrs>) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: attrs?.src ?? null } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

function VideoView({ editor, node, updateAttributes, deleteNode }: NodeViewProps) {
  const deps = useEditorDeps();
  const isEditable = useEditorEditable(editor);
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const placement = useToolbarPlacement(wrapRef);
  const { visible, show, hide } = useToolbarVisibility();

  const src = node.attrs.src as string | null;
  const error = node.attrs.error as string | null;

  const setUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    updateAttributes({ src: url, error: null });
  };

  const upload = async (file: File) => {
    if (!isVideoFile(file)) {
      updateAttributes({ error: "仅支持 mp4 / webm / ogg 视频文件" });
      return;
    }
    if (!deps.uploadAttachment) {
      updateAttributes({ error: "未注入 uploadAttachment，请在 EditorDeps 中提供" });
      return;
    }
    setUploading(true);
    setUploadName(file.name);
    try {
      const meta = await deps.uploadAttachment(file, editor);
      updateAttributes({ src: meta.url, error: null });
    } catch {
      updateAttributes({ error: "上传失败，点击重试" });
    } finally {
      setUploading(false);
      setUploadName("");
    }
  };

  const retry = () => {
    updateAttributes({ error: null });
    fileInputRef.current?.click();
  };

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className="tk-video-wrap tk-hover-toolbar"
      data-type="video"
      data-empty={src ? undefined : "true"}
      contentEditable={false}
      onMouseEnter={() => {
        if (isEditable) {
          show();
        }
      }}
      onMouseLeave={hide}
    >
      {isEditable && src && (
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                if (src) await navigator.clipboard.writeText(src);
              }}
              data-tip="复制视频链接"
            >
              <IconCopy />
            </button>
            <button
              type="button"
              className="tk-ct-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-tip="替换视频"
            >
              <IconUpload />
            </button>
            <button
              type="button"
              className="tk-ct-btn is-danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteNode()}
              data-tip="删除"
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}

      {/* 隐藏文件选择器：无论是否已有视频都要渲染（替换视频按钮依赖它） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {src ? (
        <video src={src} controls preload="metadata" className="tk-video-player" />
      ) : (
        <div className="tk-video-card">
          {uploading ? (
            <div className="tk-video-card-status">
              <IconSpinner />
              <span>{uploadName}</span>
            </div>
          ) : error ? (
            <button type="button" className="tk-video-card-status is-error" onClick={retry}>
              {error}
            </button>
          ) : (
            <>
              <div className="tk-video-card-row">
                <IconLink />
                <input
                  className="tk-video-card-input"
                  placeholder="粘贴视频链接（mp4 / webm / ogg）"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setUrl();
                    }
                  }}
                />
                <button type="button" className="tk-video-card-btn" onMouseDown={(e) => e.preventDefault()} onClick={setUrl}>
                  嵌入
                </button>
              </div>
              <button type="button" className="tk-video-card-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
                <IconUpload /> 上传视频
              </button>
            </>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
