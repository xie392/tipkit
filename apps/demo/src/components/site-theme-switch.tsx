"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Moon, PenLine, Sun } from "lucide-react";
import { useDemoLang } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

const THEMES = [
  { id: "default", icon: Sun, swatch: "#ffffff", swatchColor: "#111111" },
  { id: "sketch", icon: PenLine, swatch: "#f6f5f4", swatchColor: "#31302e" },
  { id: "dark", icon: Moon, swatch: "#1c1b19", swatchColor: "#e6e3dd" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "tipkit-site-theme";
const THEME_CLASSES = THEMES.map((t) => `tk-theme-${t.id}`);

/**
 * 全站主题切换：单个图标按钮 + 弹出面板（默认 / 手绘 / 暗色）。
 * 通过给 <html> 添加 tk-theme-* 类切换主题，选择持久化到 localStorage。
 */
export function SiteThemeSwitch() {
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].themeMenu;
  const [theme, setTheme] = useState<ThemeId>("default");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved && THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : "default";
    setTheme(initial);
    const root = document.documentElement;
    root.classList.remove(...THEME_CLASSES);
    root.classList.add(`tk-theme-${initial}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击面板外 / Esc 关闭
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

  const applyTheme = (next: ThemeId) => {
    setTheme(next);
    const root = document.documentElement;
    root.classList.remove(...THEME_CLASSES);
    root.classList.add(`tk-theme-${next}`);
    localStorage.setItem(STORAGE_KEY, next);
    setOpen(false);
  };

  const CurrentIcon = THEMES.find((t) => t.id === theme)?.icon ?? Sun;

  return (
    <div className="site-theme-switch" ref={rootRef}>
      <button
        type="button"
        className="site-theme-switch-trigger"
        aria-label={c.triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${c.current}：${c.items[theme].label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="site-theme-menu" role="menu" aria-label={c.menuLabel}>
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="site-theme-menu-item"
                data-active={active || undefined}
                onClick={() => applyTheme(t.id)}
              >
                <span
                  className="site-theme-swatch"
                  style={{ background: t.swatch, color: t.swatchColor }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="site-theme-menu-text">
                  <span className="site-theme-menu-label">{c.items[t.id].label}</span>
                  <span className="site-theme-menu-desc">{c.items[t.id].desc}</span>
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
