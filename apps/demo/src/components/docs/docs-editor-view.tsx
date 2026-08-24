"use client";

import { useMemo } from "react";
import { TipKitEditor } from "@tipkit/editor";
import type { EditorDeps } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import { createT, en, zh } from "@tipkit/core";

/**
 * 文档只读渲染：纯 Markdown 源 → TipKit 编辑器展示。
 * 语言由路径决定（/docs → zh、/en/docs → en），服务端已选出对应源，
 * 切换语言 = 导航，本组件无需监听语言事件、也不会重挂载。
 * 主题跟随站点 <html> 上的 tk-theme-* 类联动切换。
 */
export function DocsEditorView({
  source,
  lang,
  head,
}: {
  source: string;
  lang: "zh" | "en";
  head: { title: string; lead: string };
}) {
  const deps = useMemo<EditorDeps>(() => ({ t: createT(lang === "en" ? en : zh) }), [lang]);

  return (
    <>
      <div className="docs-head">
        <h1 className="docs-title">{head.title}</h1>
        <p className="docs-lead">{head.lead}</p>
      </div>
      <TipKitEditor
        deps={deps}
        content={source}
        contentType="markdown"
        editable={false}
        extensions={[...createBasicExtensions(), ...createAdvancedExtensions()]}
        className="docs-editor-view"
      />
    </>
  );
}
