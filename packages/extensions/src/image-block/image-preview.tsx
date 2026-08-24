import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@tipkit/core";

export interface ImagePreviewProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.2;
const ROTATE_STEP = 90;

function IconZoomOut() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function IconRotateLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function IconRotateRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ImagePreview({ src, alt, onClose }: ImagePreviewProps) {
  const t = useT();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const reset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const clampScale = useCallback((s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)), []);

  const zoom = useCallback(
    (delta: number, center?: { x: number; y: number }) => {
      setScale((prev) => {
        const next = clampScale(Number((prev + delta).toFixed(2)));
        if (next === prev) return prev;
        if (center && imgRef.current) {
          const rect = imgRef.current.getBoundingClientRect();
          const cx = center.x - (rect.left + rect.width / 2);
          const cy = center.y - (rect.top + rect.height / 2);
          const ratio = next / prev;
          setPosition((p) => ({
            x: p.x - cx * (ratio - 1),
            y: p.y - cy * (ratio - 1),
          }));
        }
        return next;
      });
    },
    [clampScale],
  );

  const rotate = useCallback((delta: number) => {
    setRotation((r) => (r + delta + 360) % 360);
  }, []);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoom(ZOOM_STEP);
          break;
        case "-":
          e.preventDefault();
          zoom(-ZOOM_STEP);
          break;
        case "0":
          e.preventDefault();
          reset();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setPosition((p) => ({ ...p, x: p.x + 40 }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPosition((p) => ({ ...p, x: p.x - 40 }));
          break;
        case "ArrowUp":
          e.preventDefault();
          setPosition((p) => ({ ...p, y: p.y + 40 }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setPosition((p) => ({ ...p, y: p.y - 40 }));
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, zoom, reset]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoom(delta, { x: e.clientX, y: e.clientY });
    },
    [zoom],
  );

  const onImgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [scale, position],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + dx,
        y: dragStart.current.posY + dy,
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (scale !== 1) {
        reset();
      } else {
        zoom(ZOOM_STEP * 2, { x: e.clientX, y: e.clientY });
      }
    },
    [scale, reset, zoom],
  );

  const zoomPercent = Math.round(scale * 100);

  return createPortal(
    <div
      className="tk-image-preview-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={onWheel}
      role="dialog"
      aria-modal="true"
    >
      <div className="tk-image-preview-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="tk-image-preview-btn"
          title="缩小 (-)"
          aria-label="缩小"
          onClick={() => zoom(-ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
        >
          <IconZoomOut />
        </button>
        <span className="tk-image-preview-zoom">{zoomPercent}%</span>
        <button
          type="button"
          className="tk-image-preview-btn"
          title="放大 (+)"
          aria-label="放大"
          onClick={() => zoom(ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
        >
          <IconZoomIn />
        </button>
        <span className="tk-image-preview-sep" />
        <button
          type="button"
          className="tk-image-preview-btn"
          title="向左旋转"
          aria-label="向左旋转"
          onClick={() => rotate(-ROTATE_STEP)}
        >
          <IconRotateLeft />
        </button>
        <button
          type="button"
          className="tk-image-preview-btn"
          title="向右旋转"
          aria-label="向右旋转"
          onClick={() => rotate(ROTATE_STEP)}
        >
          <IconRotateRight />
        </button>
        <span className="tk-image-preview-sep" />
        <button
          type="button"
          className="tk-image-preview-btn"
          title="重置 (0)"
          aria-label="重置"
          onClick={reset}
        >
          <IconReset />
        </button>
        <button
          type="button"
          className="tk-image-preview-btn"
          title="下载"
          aria-label="下载"
          onClick={handleDownload}
        >
          <IconDownload />
        </button>
        <span className="tk-image-preview-sep" />
        <button
          type="button"
          className="tk-image-preview-btn tk-image-preview-close"
          title={t("imagePreview.close")}
          aria-label={t("imagePreview.close")}
          onClick={onClose}
        >
          <IconClose />
        </button>
      </div>

      <div className="tk-image-preview-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          className={`tk-image-preview-img${isDragging ? " is-dragging" : ""}`}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          onMouseDown={onImgMouseDown}
          onDoubleClick={onDoubleClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>

      {naturalSize.w > 0 && (
        <div className="tk-image-preview-info" onMouseDown={(e) => e.stopPropagation()}>
          {naturalSize.w} × {naturalSize.h}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default ImagePreview;
