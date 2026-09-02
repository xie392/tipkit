"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT, useEditorEditable } from "@tipkit/core";
import { IconCheck, IconChevron, IconCopy, IconMoon, IconSun, IconTrash } from "./code-block-icons";
import { IconCode, IconExpand, IconEye } from "./mermaid-icons";
import { MermaidPreview } from "./mermaid-preview";
import { mermaidGrammar } from "./mermaid-grammar";

const lowlight = createLowlight(common);
lowlight.register({ mermaid: mermaidGrammar });

export type CodeBlockTheme = "light" | "dark";

export interface CodeLanguage {
  value: string | null;
  label: string;
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: null, label: "" },
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
  { value: "mermaid", label: "" },
  { value: "bash", label: "Bash / Shell" },
  { value: "shell", label: "" },
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

function langLabel(value: string | null, t: (k: string) => string): string {
  const canonical = canonicalLang(value);
  if (!canonical) return t("codeBlock.plainText");
  if (canonical === "mermaid") return t("codeBlock.mermaid");
  return CODE_LANGUAGES.find((l) => l.value === canonical)?.label || value || t("codeBlock.plainText");
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

function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, editor } = props;
  const t = useT();
  const isEditable = useEditorEditable(editor);
  const language = (node.attrs.language as string | null) ?? null;
  const dark = (node.attrs.theme as CodeBlockTheme) === "dark";
  const isMermaid = language === "mermaid";

  const [langOpen, setLangOpen] = useState(false);
  /* Mermaid KaTeX 式交互：默认只显示渲染图；代码在内容为空时自动展开，
   * 双击图表或点工具栏按钮进入代码编辑。非 mermaid 块忽略此状态。 */
  const [codeOpen, setCodeOpen] = useState(() => isMermaid && !node.textContent.trim());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [userSelectedAuto, setUserSelectedAuto] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxHeight: number;
    placement: "bottom" | "top";
  }>({ top: 0, left: 0, minWidth: 160, maxHeight: 280, placement: "bottom" });
  const prevContentRef = useRef(node.textContent);

  /* mermaid 内容被清空（切换语言/删空代码）时自动展开代码编辑区 */
  useEffect(() => {
    if (isMermaid && !node.textContent.trim()) setCodeOpen(true);
  }, [isMermaid, node.textContent]);

  const DROPDOWN_WIDTH = 200;
  const GAP = 4;
  const MARGIN = 8;

  const posRef = useRef(dropdownStyle);
  posRef.current = dropdownStyle;

  const calcPosition = useCallback(() => {
    if (!langBtnRef.current) return;
    const rect = langBtnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropdownH = dropdownRef.current?.offsetHeight || 280;

    let left = rect.right - DROPDOWN_WIDTH;
    if (left < MARGIN) left = MARGIN;
    if (left + DROPDOWN_WIDTH > vw - MARGIN) left = vw - DROPDOWN_WIDTH - MARGIN;

    const spaceBelow = vh - rect.bottom - MARGIN;
    const spaceAbove = rect.top - MARGIN;

    let top: number;
    let placement: "bottom" | "top";
    let maxHeight: number;

    if (spaceBelow >= dropdownH + GAP || spaceBelow >= spaceAbove) {
      placement = "bottom";
      top = rect.bottom + GAP;
      maxHeight = Math.min(280, spaceBelow - GAP);
    } else {
      placement = "top";
      maxHeight = Math.min(280, spaceAbove - GAP);
      top = rect.top - GAP - maxHeight;
    }

    const next = { top, left, minWidth: Math.max(160, rect.width), maxHeight, placement };
    const prev = posRef.current;
    if (
      prev.top === next.top &&
      prev.left === next.left &&
      prev.minWidth === next.minWidth &&
      prev.maxHeight === next.maxHeight &&
      prev.placement === next.placement
    ) {
      return;
    }
    posRef.current = next;
    setDropdownStyle(next);
  }, []);

  useLayoutEffect(() => {
    if (!langOpen) return;
    calcPosition();
    requestAnimationFrame(calcPosition);
  }, [langOpen, calcPosition]);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !langBtnRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [langOpen, calcPosition]);

  useEffect(() => {
    if (!isEditable) return;
    if (language || autoDetected || userSelectedAuto) return;
    const detected = detectLanguage(node.textContent);
    if (detected) {
      updateAttributes({ language: detected });
      setAutoDetected(true);
    }
    prevContentRef.current = node.textContent;
  }, [node.textContent, language, autoDetected, userSelectedAuto, updateAttributes, isEditable]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isEditable) setLangOpen(false);
  }, [isEditable]);

  return (
    <NodeViewWrapper
      as="div"
      className={`tk-code-block tk-group ${dark ? "tk-code-block-dark" : "tk-code-block-light"}`}
      data-theme={dark ? "dark" : "light"}
      data-language={language ?? undefined}
      data-toolbar-open={langOpen ? "true" : undefined}
      data-editable={isEditable ? "true" : "false"}
    >
      {isEditable && (
      <div
        className="tk-code-block-toolbar"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="tk-code-block-lang-wrap">
          <button
            ref={langBtnRef}
            type="button"
            className="tk-code-block-lang-btn"
            onClick={() => setLangOpen((v) => !v)}
            data-tip={t("codeBlock.setLanguage")}
            aria-label={t("codeBlock.setLanguage")}
          >
            {language === null ? t("codeBlock.auto") : langLabel(language, t)}
            <IconChevron />
          </button>
          {langOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={dropdownRef}
                className={`tk-code-block-lang-dropdown tk-code-block-lang-dropdown--portal ${dark ? "tk-code-block-dark-dropdown" : "tk-code-block-light-dropdown"}`}
                style={{
                  position: "fixed",
                  top: dropdownStyle.top,
                  left: dropdownStyle.left,
                  minWidth: dropdownStyle.minWidth,
                  maxHeight: dropdownStyle.maxHeight,
                }}
              >
                {CODE_LANGUAGES.filter((l) => l.value === null || l.label || l.value === "mermaid").map((l) => {
                  const active = canonicalLang(l.value) === canonicalLang(language);
                  return (
                    <button
                      key={l.value ?? "__plain__"}
                      type="button"
                      className={`tk-code-block-lang-option ${active ? "is-active" : ""}`}
                      onClick={() => {
                        updateAttributes({ language: l.value });
                        setAutoDetected(false);
                        setUserSelectedAuto(l.value === null);
                        setLangOpen(false);
                      }}
                    >
                      <span>{l.value === null ? t("codeBlock.auto") : langLabel(l.value, t)}</span>
                      {active && <span className="tk-code-block-check">✓</span>}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>

        <div className="tk-code-block-actions">
          {isMermaid && (
            <>
              <button
                type="button"
                className="tk-code-block-action-btn"
                onClick={() => setCodeOpen((v) => !v)}
                data-tip={codeOpen ? t("codeBlock.showDiagram") : t("codeBlock.showCode")}
                aria-label={codeOpen ? t("codeBlock.showDiagram") : t("codeBlock.showCode")}
              >
                {codeOpen ? <IconEye /> : <IconCode />}
              </button>
              <button
                type="button"
                className="tk-code-block-action-btn"
                onClick={() => setViewerOpen(true)}
                data-tip={t("codeBlock.fullscreen")}
                aria-label={t("codeBlock.fullscreen")}
              >
                <IconExpand />
              </button>
            </>
          )}
          <button
            type="button"
            className="tk-code-block-action-btn"
            onClick={() => updateAttributes({ theme: dark ? "light" : "dark" })}
            data-tip={dark ? t("codeBlock.switchLight") : t("codeBlock.switchDark")}
            aria-label={dark ? t("codeBlock.switchLight") : t("codeBlock.switchDark")}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="tk-code-block-action-btn"
            onClick={copyCode}
            data-tip={copied ? t("codeBlock.copied") : t("codeBlock.copy")}
            aria-label={copied ? t("codeBlock.copied") : t("codeBlock.copy")}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <button
            type="button"
            className="tk-code-block-action-btn tk-code-block-action-danger"
            onClick={() => deleteNode()}
            data-tip={t("codeBlock.delete")}
            aria-label={t("codeBlock.delete")}
          >
            <IconTrash />
          </button>
        </div>
      </div>
      )}

      <pre
        className="tk-code-block-pre"
        style={isMermaid && !codeOpen ? { display: "none" } : undefined}
      >
        <NodeViewContent
          as={"code" as never}
          className={language ? `language-${language}` : undefined}
          style={{ whiteSpace: "pre" }}
        />
      </pre>

      {isMermaid && !codeOpen && (
        <div
          onDoubleClick={isEditable ? () => setCodeOpen(true) : undefined}
          style={isEditable ? { cursor: "pointer" } : undefined}
        >
          <MermaidPreview
            code={node.textContent}
            theme={dark ? "dark" : "light"}
            fullscreen={viewerOpen}
            onCloseFullscreen={() => setViewerOpen(false)}
          />
        </div>
      )}

      {!isEditable && isMermaid && !codeOpen && (
        <button
          type="button"
          className="tk-code-block-copy-btn"
          style={{ top: "8px", right: "40px" }}
          onClick={() => setViewerOpen(true)}
          data-tip={t("codeBlock.fullscreen")}
          aria-label={t("codeBlock.fullscreen")}
        >
          <IconExpand />
        </button>
      )}
      {!isEditable && (
        <button
          type="button"
          className="tk-code-block-copy-btn"
          onClick={copyCode}
          data-tip={copied ? t("codeBlock.copied") : t("codeBlock.copy")}
          aria-label={copied ? t("codeBlock.copied") : t("codeBlock.copy")}
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const CustomCodeBlock = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: null,
  enableTabIndentation: true,
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
