"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";

/** 支持的语言（与 @tipkit/core 内置词典对齐） */
const LANGS = [
  { id: "zh", label: "中文", short: "中" },
  { id: "en", label: "English", short: "En" },
] as const;

export type DemoLang = (typeof LANGS)[number]["id"];

export const DEMO_LANG_EVENT = "tipkit-demo-lang-change";
const STORAGE_KEY = "tipkit-demo-lang";

/** 读取已持久化的语言（默认 zh） */
export function readDemoLang(): DemoLang {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return LANGS.some((l) => l.id === saved) ? (saved as DemoLang) : "zh";
}

/**
 * 全站语言切换：单个图标按钮 + 弹出菜单（中文 / English）。
 * 选择持久化到 localStorage，并通过 window 自定义事件 `tipkit-demo-lang-change`
 * 通知监听者（DemoEditor）切换编辑器 i18n 词典。
 */
export function SiteLangSwitch() {
  const [lang, setLang] = useState<DemoLang>("zh");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(readDemoLang());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (next: DemoLang) => {
    setLang(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(DEMO_LANG_EVENT, { detail: next }));
    setOpen(false);
  };

  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <div className="site-theme-switch" ref={rootRef}>
      <button
        type="button"
        className="site-theme-switch-trigger"
        aria-label="切换语言"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`当前语言：${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Languages className="w-4 h-4" />
      </button>

      {open && (
        <div className="site-theme-menu" role="menu" aria-label="语言选项">
          {LANGS.map((l) => {
            const active = lang === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="site-theme-menu-item"
                data-active={active || undefined}
                onClick={() => apply(l.id)}
              >
                <span className="site-theme-swatch" style={{ background: "#f3f4f6", color: "#111111" }}>
                  <span className="text-[11px] font-medium">{l.short}</span>
                </span>
                <span className="site-theme-menu-text">
                  <span className="site-theme-menu-label">{l.label}</span>
                  <span className="site-theme-menu-desc">
                    {l.id === "zh" ? "默认中文词典" : "Built-in English"}
                  </span>
                </span>
                {active && <Check className="site-theme-menu-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
