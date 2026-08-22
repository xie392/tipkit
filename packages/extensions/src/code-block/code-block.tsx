"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import type { NodeViewProps } from "@tiptap/react";
import { useRef, useState } from "react";

/* CustomCodeBlock（迁移自 blog rich-text/code-block-node.tsx）。
 * - CodeBlockLowlight 实时语法高亮 + theme 属性（light/dark）
 * - 最小 NodeView：语言选择 / 复制 / 删除，视觉走主题 CSS
 * 完整 NodeView（明暗切换等）由主题层扩展。 */

const lowlight = createLowlight(common);

export type CodeBlockTheme = "light" | "dark";

export interface CodeLanguage {
  /** null 表示纯文本（无语言） */
  value: string | null;
  label: string;
}

/** 可选编程语言（均来自 highlight.js 常用语言集合） */
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

/** markdown 输入 / 历史数据中常见的语言别名 → 规范名 */
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

/** 代码块 NodeView：语言选择 + 复制 + 删除（语义类名，视觉归主题） */
function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, editor } = props;
  const language = (node.attrs.language as string | null) ?? null;
  const dark = (node.attrs.theme as CodeBlockTheme) === "dark";
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败
    }
  };

  return (
    <NodeViewWrapper className={`tk-code-block ${dark ? "tk-code-block-dark" : "tk-code-block-light"}`}>
      <div className="tk-code-block-bar" contentEditable={false}>
        <select
          value={language ?? ""}
          onChange={(e) => updateAttributes({ language: e.target.value || null })}
          className="tk-code-block-lang"
          title="代码语言"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value ?? "none"} value={l.value ?? ""}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="tk-code-block-lang-label">{langLabel(language)}</span>
        <span className="tk-code-block-actions">
          <button type="button" className="tk-code-block-btn" onClick={copyCode} title="复制代码">
            {copied ? "✓" : "复制"}
          </button>
          {editor.isEditable && (
            <button type="button" className="tk-code-block-btn" onClick={deleteNode} title="删除代码块">
              删除
            </button>
          )}
        </span>
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

/**
 * 代码块扩展：CodeBlockLowlight + theme 属性 + 自定义 NodeView。
 * 序列化产出 `<pre data-theme="light|dark">`。
 */
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
});
