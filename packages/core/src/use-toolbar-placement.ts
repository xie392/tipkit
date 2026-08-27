import { useEffect, useState, type RefObject } from "react";

/**
 * 根据块元素相对视口顶部的距离，决定 hover 工具栏显示在块的上方还是下方。
 * 当块的顶部太靠近视口顶部（如滚动上去）时，工具栏翻转到块下方，
 * 避免工具栏被视口顶部裁切而不可见。
 *
 * @param ref 块元素（NodeViewWrapper 外层）的 ref
 * @param threshold 触发翻转的视口顶部距离阈值（px）
 * @returns "top"（工具栏在块上方）| "bottom"（工具栏在块下方）
 */
export type ToolbarPlacement = "top" | "bottom";

export function useToolbarPlacement(
  ref: RefObject<HTMLElement | null>,
  threshold = 64,
): ToolbarPlacement {
  const [placement, setPlacement] = useState<ToolbarPlacement>("top");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top;
        setPlacement((prev) => {
          const next: ToolbarPlacement = top < threshold ? "bottom" : "top";
          return next === prev ? prev : next;
        });
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [ref, threshold]);

  return placement;
}
