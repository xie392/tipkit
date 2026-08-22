"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { DemoEditor } from "@/components/demo-editor";
import { EditorToolbar } from "@/components/editor-toolbar";

/** 三种内置主题：default（编辑部精工）/ devkb / blog */
const THEMES = [
  { id: "default", label: "default", hint: "shadcn 标准风格" },
  { id: "devkb", label: "devkb", hint: "shadcn 常规" },
  { id: "blog", label: "blog", hint: "手绘线框" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export default function Home() {
  const [theme, setTheme] = useState<ThemeId>("default");
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <div className={`tk-theme-${theme} demo-shell`}>
      {/* Header：字标 + 主题切换 */}
      <header className="demo-header">
        <div className="demo-header-inner">
          <div className="demo-brand tk-reveal" style={{ animationDelay: "0.02s" }}>
            <span className="demo-brand-mark" />
            <span className="demo-brand-name">TipKit</span>
            <span className="demo-brand-sub">无头 Tiptap 编辑器</span>
          </div>
          <nav
            className="demo-switch tk-reveal"
            style={{ animationDelay: "0.08s" }}
            aria-label="主题切换"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => setTheme(t.id)}
                data-active={theme === t.id || undefined}
                className="demo-switch-btn"
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 顶部工具栏：sticky 在 header 下方（如 Notion/语雀） */}
      <div className="demo-toolbar-bar tk-reveal" style={{ animationDelay: "0.12s" }}>
        <div className="demo-toolbar-inner">
          <EditorToolbar editor={editor} />
        </div>
      </div>

      {/* 主区：仅编辑器 */}
      <main className="demo-main tk-reveal" style={{ animationDelay: "0.2s" }}>
        <DemoEditor placeholder="输入 / 打开斜杠菜单，或直接粘贴 Markdown…" onEditorReady={setEditor} />
      </main>
    </div>
  );
}
