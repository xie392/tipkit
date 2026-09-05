"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PhotoSlider } from "react-photo-view";
import { Download, Maximize2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useT } from "@tipkit/core";
import "react-photo-view/dist/react-photo-view.css";

/* 图片预览弹层：基于 react-photo-view（触摸/双指缩放/惯性拖拽/键盘由插件处理），
 * 自定义工具栏补充旋转、1:1、下载；视觉由插件自身样式提供，主题层可覆盖。 */

export interface ImagePreviewProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const SCALE_STEP = 1.25;

export function ImagePreview({ src, alt, onClose }: ImagePreviewProps) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, alt]);

  if (!mounted) return null;

  return createPortal(
    <PhotoSlider
      images={[{ key: src, src }]}
      index={0}
      visible
      onClose={onClose}
      maskOpacity={0.85}
      toolbarRender={({ rotate, onRotate, scale, onScale }) => (
        <>
          <PreviewIcon label={t("imagePreview.zoomOut")} onClick={() => onScale(scale / SCALE_STEP)}>
            <ZoomOut size={18} />
          </PreviewIcon>
          <PreviewIcon label={t("imagePreview.zoomIn")} onClick={() => onScale(scale * SCALE_STEP)}>
            <ZoomIn size={18} />
          </PreviewIcon>
          <PreviewIcon label={t("imagePreview.reset")} onClick={() => onScale(1)}>
            <Maximize2 size={18} />
          </PreviewIcon>
          <PreviewIcon label={t("imagePreview.rotateLeft")} onClick={() => onRotate(rotate - 90)}>
            <RotateCcw size={18} />
          </PreviewIcon>
          <PreviewIcon label={t("imagePreview.rotateRight")} onClick={() => onRotate(rotate + 90)}>
            <RotateCw size={18} />
          </PreviewIcon>
          <PreviewIcon label={t("imagePreview.download")} onClick={handleDownload}>
            <Download size={18} />
          </PreviewIcon>
        </>
      )}
    />,
    document.body,
  );
}

function PreviewIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="PhotoView-Slider__toolbarIcon"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default ImagePreview;
