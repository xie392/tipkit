"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DemoEditor } from "@/components/demo-editor";
import { EditorToolbar } from "@/components/editor-toolbar";
import { ExportFab } from "@/components/export-fab";
import { SiteHeader } from "@/components/site-header";
import { useDemoLang } from "@/components/use-demo-lang";
import { SITE_COPY } from "@/lib/site-i18n";
import { Eye, PencilLine } from "lucide-react";

export default function DemoPage() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const { lang } = useDemoLang();
  const c = SITE_COPY[lang].demoMode;

  return (
    <div className="demo-shell">
      <SiteHeader />

      {/* 顶部工具条：sticky 在导航下方（如 Notion/语雀）；主题切换在右上导航 */}
      <div
        className={`demo-toolbar-bar tk-reveal${readOnly ? " is-readonly" : ""}`}
        style={{ animationDelay: "0.08s" }}
      >
        <div className="demo-toolbar-inner">
          <EditorToolbar editor={editor} />
        </div>
      </div>

      {/* 主区：仅编辑器（居中） */}
      <main className="demo-main tk-reveal" style={{ animationDelay: "0.16s" }}>
        <DemoEditor onEditorReady={setEditor} editable={!readOnly} />
      </main>

      {/* 悬浮操作区：右下角固定，导出 + 编辑/只读切换 */}
      <div className="demo-fab-group">
        <ExportFab editor={editor} />
        <button
          type="button"
          className="demo-mode-toggle"
          data-readonly={readOnly || undefined}
          aria-pressed={readOnly}
          title={c.title}
          onClick={() => setReadOnly((v) => !v)}
        >
          {readOnly ? <Eye className="w-4 h-4" /> : <PencilLine className="w-4 h-4" />}
          <span>{readOnly ? c.readonly : c.edit}</span>
        </button>
      </div>
    </div>
  );
}
