import { useEffect, type RefObject } from "react";

/**
 * 浮层关闭通用逻辑：点击 refs 之外关闭、Escape 关闭，
 * 可选在 scroll/resize 时重定位（onReposition）。
 * 供 code-block / callout / image-block 等节点视图的下拉面板复用。
 */
export function useDismiss(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  onClose: () => void,
  onReposition?: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target));
      if (!inside) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    let removeReposition: (() => void) | null = null;
    if (onReposition) {
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
      removeReposition = () => {
        window.removeEventListener("scroll", onReposition, true);
        window.removeEventListener("resize", onReposition);
      };
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      removeReposition?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, onReposition]);
}
