import { useCallback, useEffect, useRef, useState } from "react";

/**
 * hover 工具栏的显隐控制（hover-intent）。
 *
 * 与"桥接区拦截指针"不同，本方案：
 * - 块上方不再放置可点击的覆盖层，避免遮挡块上方文字导致无法点击聚焦；
 * - 离开块后延迟 hide（默认 250ms），期间若移入工具栏本身则保持显示，
 *   从而跨过"块内容 -> 工具栏"之间的间隙而不消失。
 */
export function useToolbarVisibility(delay = 250) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clear();
    setVisible(true);
  }, [clear]);

  const hide = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setVisible(false), delay);
  }, [clear, delay]);

  useEffect(() => clear, [clear]);

  return { visible, show, hide };
}
