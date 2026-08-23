"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  "data-code"?: string;
  "data-language"?: string;
}

/** 代码块：服务端 shiki 已高亮（children），这里负责语言标签 + 一键复制 */
export function CodeBlock({ children, className, ...rest }: CodeBlockProps) {
  const code = rest["data-code"] ?? "";
  const lang = rest["data-language"] ?? "text";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 不可用时静默失败，不影响阅读
    }
  };

  return (
    <div className="tk-codeblock">
      <div className="tk-codeblock-bar">
        <span className="tk-codeblock-lang">{lang}</span>
        <button
          type="button"
          className="tk-codeblock-copy"
          onClick={copy}
          aria-label="复制代码"
          data-copied={copied || undefined}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre className={`tk-shiki-pre ${className ?? ""}`.trim()} {...rest}>
        {children}
      </pre>
    </div>
  );
}
