"use client";

import { createContext, useContext } from "react";
import type { EditorDeps } from "./types";

/**
 * 依赖注入容器：消费方项目通过 EditorProvider 注入上传/渲染等能力，
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
  return <EditorDepsContext.Provider value={deps}>{children}</EditorDepsContext.Provider>;
}

export function useEditorDeps(): EditorDeps {
  const deps = useContext(EditorDepsContext);
  return deps ?? {};
}
