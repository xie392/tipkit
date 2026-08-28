"use client";

import { useCallback, useEffect, useState } from "react";
import { useDemoLang } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";

interface TocEntry {
  id: string;
  text: string;
  level: number; // 2 | 3
}

/** 生成标题 slug id：转小写、去标点、中文保留、空格用 '-' 连接 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * 右侧页内目录（TOC）：
 * - 从 contentSelector 容器内提取 H2/H3，无 id 的标题自动生成 slug id 并写入 DOM；
 * - 渲染 sticky 目录列表（h2 一级、h3 缩进一级），点击平滑滚动（配合 CSS scroll-margin-top）；
 * - IntersectionObserver 实现 scroll-spy 高亮当前章节；
 * - 标题数 < 2 时返回 null 不渲染。
 * 编辑器内容为客户端异步渲染，故在挂载后通过 requestAnimationFrame + MutationObserver 确保 DOM 就绪。
 */
export function DocsToc({ contentSelector }: { contentSelector: string }) {
  const { lang } = useDemoLang();
  const toc = SITE_COPY[lang].toc;
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  /** 收集容器内标题：幂等 —— 已有 id 复用，无 id 生成并写入 */
  const collect = useCallback(() => {
    const root = document.querySelector(contentSelector);
    if (!root) return;

    const headings = Array.from(root.querySelectorAll("h2, h3"));
    if (headings.length < 2) {
      setEntries([]);
      return;
    }

    const next: TocEntry[] = [];
    const seen = new Set<string>();
    headings.forEach((h) => {
      const el = h as HTMLElement;
      const text = (el.textContent ?? "").trim();
      if (!text) return;

      let id = el.id;
      if (!id) {
        const base = slugify(text) || "section";
        id = base;
        let n = 2;
        while (seen.has(id) || document.getElementById(id)) {
          id = `${base}-${n++}`;
        }
        el.id = id;
      }
      seen.add(id);
      next.push({ id, text, level: Number(el.tagName[1]) });
    });

    setEntries((prev) => {
      if (
        prev.length === next.length &&
        prev.every((p, i) => p.id === next[i].id && p.text === next[i].text && p.level === next[i].level)
      ) {
        return prev;
      }
      return next;
    });
  }, [contentSelector]);

  // 挂载后等编辑器 DOM 就绪再收集；内容变化（MutationObserver）时重新收集。
  // 编辑器每个按键都会产生 DOM 变动，防抖避免 TOC 全量重扫跟随 keystroke 抖动
  useEffect(() => {
    const raf = requestAnimationFrame(() => collect());
    const root = document.querySelector(contentSelector);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mo = root
      ? new MutationObserver(() => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => collect(), 300);
        })
      : null;
    if (root && mo) mo.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      mo?.disconnect();
    };
  }, [collect, contentSelector]);

  // scroll-spy：IntersectionObserver 高亮当前可见标题
  useEffect(() => {
    if (entries.length < 2) return;

    const io = new IntersectionObserver(
      (intersections) => {
        const visible = intersections
          .filter((i) => i.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    entries.forEach((e) => {
      const el = document.getElementById(e.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <aside className="docs-toc">
      <p className="docs-toc-title">{toc.title}</p>
      <nav className="docs-toc-list" aria-label={toc.title}>
        {entries.map((e) => (
          <a
            key={e.id}
            href={`#${e.id}`}
            className="docs-toc-link"
            data-level={e.level}
            data-active={activeId === e.id || undefined}
            onClick={(ev) => {
              ev.preventDefault();
              document.getElementById(e.id)?.scrollIntoView({ behavior: "smooth" });
              setActiveId(e.id);
            }}
          >
            {e.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
