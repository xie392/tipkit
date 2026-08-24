"use client";

import { createContext, useContext } from "react";
import type { EditorDeps } from "./types";
import { createT, zh, type Translate } from "./i18n";

/** 默认中文翻译函数（未注入 t 时兜底） */
const defaultT = createT(zh);

/**
 * 依赖注入容器：消费方项目通过 EditorProvider 注入上传/渲染/i18n 等能力，
 * core 与 extensions 通过 useEditorDeps() 读取，禁止直接调用外部服务。
 */
const EditorDepsContext = createContext<EditorDeps | null>(null);

export function EditorProvider({
  deps,
  children,
}: {
  deps: EditorDeps;
  children: React.ReactNode;
}) {
  const merged: EditorDeps = {
    ...deps,
    t: deps.t ?? defaultT,
  };
  return <EditorDepsContext.Provider value={merged}>{children}</EditorDepsContext.Provider>;
}

export function useEditorDeps(): EditorDeps {
  const deps = useContext(EditorDepsContext);
  return deps ?? { t: defaultT };
}

/** 直接获取翻译函数（便捷 hook） */
export function useT(): Translate {
  return useEditorDeps().t ?? defaultT;
}
