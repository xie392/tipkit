import type React from "react";

/**
 * 指针拖拽公共骨架：pointer capture、move/up/cancel 监听、
 * rAF 合帧（onFrame 每帧至多一次）与清理。
 * 供 image-block（宽度拖拽）/ iframe（高度拖拽）等复用。
 */
export function beginPointerDrag(
  e: React.PointerEvent,
  opts: {
    /** 每次 pointermove：更新外部 ref 等状态（不直接操作 DOM） */
    onMove: (ev: PointerEvent) => void;
    /** rAF 合帧回调：把 ref 状态落到 DOM/React state */
    onFrame: () => void;
    /** 结束：commit=false 表示 pointercancel，放弃变更 */
    onFinish: (commit: boolean) => void;
  },
) {
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture(e.pointerId);

  let rafId: number | null = null;
  const scheduleFrame = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      opts.onFrame();
    });
  };

  const finish = (commit: boolean) => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    opts.onFinish(commit);
  };
  const onMove = (ev: PointerEvent) => {
    opts.onMove(ev);
    scheduleFrame();
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onCancel);
}
