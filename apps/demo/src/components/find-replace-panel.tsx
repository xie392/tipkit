"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { searchAndReplaceKey } from "@tipkit/extensions";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useDemoLang } from "@/components/use-demo-lang";

/**
 * 查找替换面板（语雀式）：查找 / 替换 Tab、匹配计数、上一个 / 下一个、
 * 替换单个 / 全部替换。逻辑全部走 SearchAndReplace 扩展命令。
 */
export function FindReplacePanel({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const { t } = useDemoLang();
  const [tab, setTab] = useState<"find" | "replace">("find");
  const [term, setTerm] = useState("");
  const [replacement, setReplacement] = useState("");
  const [count, setCount] = useState({ total: 0, active: 0 });

  // 订阅事务：搜索词不变、文档变化时扩展会自动重算匹配，这里同步计数
  useEffect(() => {
    const refresh = () => {
      const s = searchAndReplaceKey.getState(editor.state);
      setCount({
        total: s?.matches.length ?? 0,
        active: s && s.activeIndex >= 0 ? s.activeIndex + 1 : 0,
      });
    };
    refresh();
    editor.on("transaction", refresh);
    return () => {
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const changeTerm = (value: string) => {
    setTerm(value);
    // 不 focus 编辑器，避免输入框失焦；空词时清空搜索态
    if (value) {
      editor.chain().setSearchTerm(value).run();
    } else {
      editor.chain().clearSearch().run();
    }
  };

  // 不 focus 编辑器：焦点保持在面板内，否则 Radix Popover 会因 focusOutside 关闭；
  // 编辑器无焦点时 PM 的 scrollIntoView 不生效，这里手动把当前匹配滚到视口中央
  const scrollToActive = () => {
    requestAnimationFrame(() => {
      editor.view.dom
        .querySelector(".tk-search-match.is-active")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };
  const goNext = () => {
    editor.chain().nextSearchMatch().run();
    scrollToActive();
  };
  const goPrev = () => {
    editor.chain().previousSearchMatch().run();
    scrollToActive();
  };

  const replaceOne = () => {
    editor.chain().replaceSearchMatch(replacement).run();
    scrollToActive();
  };
  const replaceAll = () => {
    editor.chain().replaceAllSearchMatches(replacement).run();
  };

  const hasMatches = count.total > 0;

  return (
    <div className="tk-find-panel w-80 select-none" onKeyDown={(e) => e.stopPropagation()}>
      {/* Tab：查找 / 替换（参考语雀） */}
      <div className="flex items-center gap-4 border-b border-border px-3 pt-2">
        {(["find", "replace"] as const).map((key) => (
          <button
            key={key}
            type="button"
            data-active={tab === key || undefined}
            className="tk-find-tab pb-1.5 text-sm text-muted-foreground data-[active]:text-foreground data-[active]:font-medium"
            onClick={() => setTab(key)}
          >
            {key === "find" ? t("find.tab") : t("replace.tab")}
          </button>
        ))}
        <button
          type="button"
          aria-label={t("link.cancel")}
          className="ml-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* 查找行：输入框 + 计数 + 上一个/下一个 */}
        <div className="flex items-center gap-1.5">
          <div className="tk-find-input-wrap relative flex-1">
            <input
              autoFocus
              value={term}
              onChange={(e) => changeTerm(e.target.value)}
              placeholder={t("find.searchPlaceholder")}
              className="tk-find-input h-8 w-full rounded-md border border-border bg-background px-2.5 pr-10 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) goPrev();
                  else goNext();
                }
              }}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
              {term ? (hasMatches ? `${count.active}/${count.total}` : t("find.noResults")) : ""}
            </span>
          </div>
          <button
            type="button"
            aria-label={t("find.prev")}
            disabled={!hasMatches}
            className="tk-find-btn inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={goPrev}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={t("find.next")}
            disabled={!hasMatches}
            className="tk-find-btn inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={goNext}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* 替换行：仅替换 Tab 显示 */}
        {tab === "replace" && (
          <div className="flex items-center gap-1.5">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={t("find.replacePlaceholder")}
              className="tk-find-input h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (hasMatches) replaceOne();
                }
              }}
            />
            <button
              type="button"
              disabled={!hasMatches || !term}
              className="tk-find-btn h-8 shrink-0 rounded-md border border-border px-2.5 text-xs text-foreground hover:bg-accent disabled:opacity-40"
              onClick={replaceOne}
            >
              {t("find.replace")}
            </button>
            <button
              type="button"
              disabled={!hasMatches || !term}
              className="tk-find-btn h-8 shrink-0 rounded-md border border-border px-2.5 text-xs text-foreground hover:bg-accent disabled:opacity-40"
              onClick={replaceAll}
            >
              {t("find.replaceAll")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
