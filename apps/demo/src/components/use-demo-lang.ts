"use client";

import { useEffect, useMemo, useState } from "react";
import { createT, zh, en, type Translate } from "@tipkit/core";
import {
  DEMO_LANG_EVENT,
  readDemoLang,
  type DemoLang,
} from "@/components/site-lang-switch";

/**
 * demo 共享语言 hook：监听 SiteLangSwitch 派发的事件 + localStorage 持久化。
 * 返回当前语言与对应的 t 函数，供 demo-editor / editor-toolbar 等页面级组件使用。
 *
 * 编辑器内部扩展（SlashMenu / Katex / 浮层等）走 EditorDeps.t 注入，
 * 不需要本 hook。
 */
export function useDemoLang(): { lang: DemoLang; t: Translate } {
  const [lang, setLang] = useState<DemoLang>("zh");

  useEffect(() => {
    setLang(readDemoLang());
    const handler = (e: Event) => setLang((e as CustomEvent<DemoLang>).detail);
    window.addEventListener(DEMO_LANG_EVENT, handler);
    return () => window.removeEventListener(DEMO_LANG_EVENT, handler);
  }, []);

  const t = useMemo<Translate>(() => createT(lang === "en" ? en : zh), [lang]);
  return { lang, t };
}
