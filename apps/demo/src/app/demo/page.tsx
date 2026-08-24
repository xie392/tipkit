"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DemoEditor } from "@/components/demo-editor";
import { EditorToolbar } from "@/components/editor-toolbar";
import { SiteHeader } from "@/components/site-header";

export default function DemoPage() {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <div className="demo-shell">
      <SiteHeader />

      {/* 顶部工具条：sticky 在导航下方（如 Notion/语雀）；主题切换在右上导航 */}
      <div className="demo-toolbar-bar tk-reveal" style={{ animationDelay: "0.08s" }}>
        <div className="demo-toolbar-inner">
          <EditorToolbar editor={editor} />
        </div>
      </div>

      {/* 主区：仅编辑器 */}
      <main className="demo-main tk-reveal" style={{ animationDelay: "0.16s" }}>
        <DemoEditor onEditorReady={setEditor} />
      </main>
    </div>
  );
}
