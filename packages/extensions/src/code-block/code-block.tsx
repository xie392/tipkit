"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

const lowlight = createLowlight(common);

export type CodeBlockTheme = "light" | "dark";

export interface CodeLanguage {
  value: string | null;
  label: string;
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: null, label: "纯文本" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "xml", label: "XML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "bash", label: "Bash / Shell" },
  { value: "shell", label: "Shell 会话" },
  { value: "graphql", label: "GraphQL" },
  { value: "ini", label: "INI / TOML" },
  { value: "makefile", label: "Makefile" },
  { value: "lua", label: "Lua" },
  { value: "perl", label: "Perl" },
  { value: "objectivec", label: "Objective-C" },
  { value: "r", label: "R" },
  { value: "diff", label: "Diff" },
];

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  zsh: "bash",
  md: "markdown",
  h: "c",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  yml: "yaml",
  toml: "ini",
};

function canonicalLang(value: string | null): string | null {
  return value ? LANGUAGE_ALIASES[value] ?? value : null;
}

function langLabel(value: string | null): string {
  const canonical = canonicalLang(value);
  return CODE_LANGUAGES.find((l) => l.value === canonical)?.label ?? value ?? "纯文本";
}

function detectLanguage(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  if (/^(import|export|const|let|var|function|class|interface|type|from)\b/.test(trimmed) && /[;{}()]/.test(trimmed)) {
    if (trimmed.includes(":") || trimmed.includes("interface ") || trimmed.includes("<")) return "typescript";
    return "javascript";
  }
  if (/^(def |class |import |from |if __name__)/.test(trimmed) || /:\s*$/.test(trimmed.split("\n")[0] || "")) {
    return "python";
  }
  if (/^(public|private|protected|static|void|class|package)\b/.test(trimmed)) {
    return "java";
  }
  if (/^#include\b/.test(trimmed) || /\b(int|char|void|struct)\s+\w+\s*\(/.test(trimmed)) {
    return "cpp";
  }
  if (/^package\s+main\b/m.test(trimmed) || /^func\s+\w+\s*\(/m.test(trimmed)) {
    return "go";
  }
  if (/^fn\s+\w+|^let\s+mut\b|^use\s+std::/m.test(trimmed)) {
    return "rust";
  }
  if (/^<!DOCTYPE|^<html[\s>]|^<\?xml/m.test(trimmed)) {
    return "html";
  }
  if (/^{[\s\S]*}$/.test(trimmed) && /"[^"]+"\s*:/.test(trimmed)) {
    return "json";
  }
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmed)) {
    return "sql";
  }
  if (/^(#|---|\*\*|__)\w/m.test(trimmed) || /\[.+\]\(.+\)/.test(trimmed)) {
    return "markdown";
  }
  if (/^(@import|@media|[.#][\w-]+\s*\{)/m.test(trimmed)) {
    return "css";
  }
  if (/^(#!\s*\/.*\/(ba)?sh|^echo |^export |^\w+=\$\()/m.test(trimmed)) {
    return "bash";
  }

  return null;
}

function IconChevron() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-xs" fill="currentColor">
      <path d="M4.5 6l3.5 3.5L11.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-sm" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-sm" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-sm" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-sm" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" className="tk-icon-sm" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v3.5M9.5 7v3.5" />
    </svg>
  );
}

function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, editor } = props;
  const language = (node.attrs.language as string | null) ?? null;
  const dark = (node.attrs.theme as CodeBlockTheme) === "dark";

  const [langOpen, setLangOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef(node.textContent);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  useEffect(() => {
    if (language || autoDetected) return;
    const detected = detectLanguage(node.textContent);
    if (detected) {
      updateAttributes({ language: detected });
      setAutoDetected(true);
    }
    prevContentRef.current = node.textContent;
  }, [node.textContent, language, autoDetected, updateAttributes]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`tk-code-block tk-group ${dark ? "tk-code-block-dark" : "tk-code-block-light"}`}
      data-theme={dark ? "dark" : "light"}
      data-language={language ?? undefined}
    >
      <div
        className="tk-code-block-toolbar"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div ref={langRef} className="tk-code-block-lang-wrap">
          <button
            type="button"
            className="tk-code-block-lang-btn"
            onClick={() => setLangOpen((v) => !v)}
            title="设置编程语言"
          >
            {langLabel(language)}
            <IconChevron />
          </button>
          {langOpen && (
            <div className="tk-code-block-lang-dropdown">
              {CODE_LANGUAGES.map((l) => {
                const active = canonicalLang(l.value) === canonicalLang(language);
                return (
                  <button
                    key={l.value ?? "__plain__"}
                    type="button"
                    className={`tk-code-block-lang-option ${active ? "is-active" : ""}`}
                    onClick={() => {
                      updateAttributes({ language: l.value });
                      setAutoDetected(false);
                      setLangOpen(false);
                    }}
                  >
                    <span>{l.label}</span>
                    {active && <span className="tk-code-block-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="tk-code-block-actions">
          <button
            type="button"
            className="tk-code-block-action-btn"
            onClick={() => updateAttributes({ theme: dark ? "light" : "dark" })}
            title={dark ? "切换到亮色主题" : "切换到暗色主题"}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="tk-code-block-action-btn"
            onClick={copyCode}
            title="复制代码"
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
          {editor.isEditable && (
            <button
              type="button"
              className="tk-code-block-action-btn tk-code-block-action-danger"
              onClick={() => deleteNode()}
              title="删除代码块"
            >
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      <pre className="tk-code-block-pre">
        <NodeViewContent
          as={"code" as never}
          className={language ? `language-${language}` : undefined}
          style={{ whiteSpace: "pre" }}
        />
      </pre>
    </NodeViewWrapper>
  );
}

export const CustomCodeBlock = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: null,
}).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      theme: {
        default: "dark",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-theme") === "light" ? "light" : "dark",
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.theme === "light" ? { "data-theme": "light" } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addKeyboardShortcuts() {
    const handleSelectAll = () => {
      const { state } = this.editor;
      const { selection } = state;
      const { $from, $to } = selection;

      const codeBlockType = this.type;
      const inSameCodeBlock =
        $from.parent.type === codeBlockType &&
        $to.parent.type === codeBlockType &&
        $from.before($from.depth) === $to.before($to.depth);

      if (inSameCodeBlock) {
        const blockStart = $from.start($from.depth);
        const blockEnd = $from.end($from.depth);

        const isFullBlockSelected =
          selection.from === blockStart && selection.to === blockEnd;

        if (!isFullBlockSelected) {
          this.editor.commands.setTextSelection({ from: blockStart, to: blockEnd });
          return true;
        }
      }

      return false;
    };

    return {
      "Mod-a": handleSelectAll,
    };
  },
});
