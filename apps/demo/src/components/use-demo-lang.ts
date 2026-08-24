"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createT, zh, en, type Translate } from "@tipkit/core";
import {
  DEMO_LANG_EVENT,
  readDemoLang,
  type DemoLang,
} from "@/components/site-lang-switch";

/**
 * demo 共享语言 hook。
 *
 * 语言来源（优先级从高到低）：
 * 1. 路径前缀 /en/** 与 /zh/**（文档页的路径切换方案，SSR 即确定，无闪烁）；
 * 2. localStorage + 语言切换事件（首页 / 演示页的客户端切换）。
 *
 * 编辑器内部扩展（SlashMenu / Katex / 浮层等）走 EditorDeps.t 注入，
 * 不需要本 hook。
 */
export function useDemoLang(): { lang: DemoLang; t: Translate } {
  const pathname = usePathname();
  const [saved, setSaved] = useState<DemoLang>("zh");

  useEffect(() => {
    setSaved(readDemoLang());
    const handler = (e: Event) => setSaved((e as CustomEvent<DemoLang>).detail);
    window.addEventListener(DEMO_LANG_EVENT, handler);
    return () => window.removeEventListener(DEMO_LANG_EVENT, handler);
  }, []);

  const lang: DemoLang = pathname?.startsWith("/en/")
    ? "en"
    : pathname?.startsWith("/zh/")
      ? "zh"
      : saved;

  const t = useMemo<Translate>(() => createT(lang === "en" ? en : zh), [lang]);
  return { lang, t };
}

/** 文档链接的语言前缀：跟随当前路径区域（/en → "/en"、/zh → "/zh"、默认无前缀即中文） */
export function useDocsPathPrefix(): string {
  const pathname = usePathname();
  if (pathname?.startsWith("/en/")) return "/en";
  if (pathname?.startsWith("/zh/")) return "/zh";
  return "";
}
