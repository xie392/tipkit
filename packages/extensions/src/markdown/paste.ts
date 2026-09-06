import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { MarkdownManager } from "@tiptap/markdown";

/* Markdown 粘贴（迁移自 blog rich-text/markdown-paste.ts）。
 * 粘贴纯文本 Markdown 时解析为富文本节点，依赖 @tiptap/markdown。
 * 配置 onMarkdownDetected 时交由消费方确认（如弹窗询问是否转换）；
 * 未配置时保持原行为：检测到 Markdown 自动转换。
 * 转换按顶层块逐块解析：解析不了的块退回纯文本，其余块正常转换。 */

/** MarkdownPaste 确认回调可执行的动作 */
export interface MarkdownPasteActions {
  /** 转换为编辑器富文本（标题/列表/加粗/代码块等） */
  convert: () => void;
  /** 按纯文本原样插入（保留换行结构） */
  insertPlain: () => void;
}

export interface MarkdownPasteOptions {
  /** 检测到纯文本 Markdown 粘贴时触发；不配置则自动转换 */
  onMarkdownDetected?: (text: string, actions: MarkdownPasteActions) => void;
}

/** 判断纯文本是否带明显的 Markdown 语法特征（标题/列表/引用/代码块/链接/加粗等） */
function looksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~)/.test(text) ||
    /\*\*[^*\n]+\*\*|__[^_\n]+__/.test(text) ||
    /\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_/.test(text) ||
    /~~[^~\n]+~~/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /\[[^\]]+\]\([^)\s]+\)/.test(text) ||
    /(^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(\n|$)/.test(text)
  );
}

/** 剪贴板 HTML 含真实富文本结构（标题/列表/加粗/链接等）时交给 ProseMirror 默认处理 */
const RICH_HTML_RE = /<(?!\/)(h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|s|del|strike|a|table|img|mark|u)\b/i;

/** 纯文本按换行插入为段落（段内换行用 hardBreak），对齐默认纯文本粘贴的结构 */
function plainParagraphs(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const content: Array<{ type: string; text?: string }> = [];
      block.split("\n").forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line) content.push({ type: "text", text: line });
      });
      return content.length ? { type: "paragraph", content } : { type: "paragraph" };
    });
}

/* ---------- 顶层块切分：让每一块独立解析、独立兜底 ---------- */

type LineCat = "blank" | "quote" | "table" | "other";

function lineCat(line: string): LineCat {
  if (!line.trim()) return "blank";
  if (/^\s{0,3}>/.test(line)) return "quote";
  if (/^\s{0,3}\|/.test(line)) return "table";
  return "other";
}

const LIST_ITEM_RE = /^\s{0,3}(?:[-*+]\s|\d+[.)]\s)/;
const FENCE_RE = /^\s{0,3}(```|~~~)(.*)$/;

/** 按顶层块切分 Markdown：代码围栏/列表/引用/表格各自成块，段落以空行分块。
 * 目标是切出"合法的顶层块"，让每块能独立丢给解析器；块内多行结构不被拆散。
 * （导出仅为测试用） */
export function splitMarkdownSegments(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const segments: string[] = [];
  let cur: string[] = [];
  let curCat: LineCat | "list" | "fence" | null = null;
  let fenceMarker: string | null = null;

  const flush = () => {
    if (cur.length) segments.push(cur.join("\n"));
    cur = [];
    curCat = null;
  };

  for (const line of lines) {
    // 代码围栏整体成块（含到闭合围栏为止的所有行）
    if (fenceMarker) {
      cur.push(line);
      if (line.trim().startsWith(fenceMarker)) {
        flush();
        fenceMarker = null;
      }
      continue;
    }
    const fenceOpen = FENCE_RE.exec(line);
    if (fenceOpen) {
      flush();
      fenceMarker = fenceOpen[1];
      cur.push(line);
      // 单行自闭合围栏（```code```）或后续无内容时按普通块处理
      if (line.trim().endsWith(fenceMarker) && line.trim().length > 3) {
        flush();
        fenceMarker = null;
      }
      continue;
    }

    const cat = lineCat(line);
    if (cat === "blank") {
      flush();
      continue;
    }

    // 列表块：列表项及其缩进续行保持成块
    if (curCat === "list") {
      if (LIST_ITEM_RE.test(line) || /^\s{2,}\S/.test(line)) {
        cur.push(line);
        continue;
      }
      flush();
    }
    if (LIST_ITEM_RE.test(line)) {
      curCat = "list";
      cur.push(line);
      continue;
    }

    // 引用 / 表格 / 普通段落：同类相邻行合并为一块
    if (curCat !== cat) flush();
    curCat = cat;
    cur.push(line);
  }
  flush();
  return segments.filter((s) => s.trim());
}

/* ---------- 解析结果清理 ---------- */

interface JSONNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  content?: JSONNode[];
}

/** 递归去重文本节点上相同的 mark（如 @tiptap/markdown 与自定义 Link 扩展
 * 对同一链接各加一个 link mark，会导致 Invalid collection of marks 插入失败）。
 * （导出仅为测试用） */
export function sanitizeNodes(nodes: JSONNode[]): JSONNode[] {
  for (const node of nodes) {
    if (Array.isArray(node.marks)) {
      const seen = new Set<string>();
      node.marks = node.marks.filter((mark) => {
        const key = JSON.stringify([mark.type, mark.attrs ?? null]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (Array.isArray(node.content)) sanitizeNodes(node.content);
  }
  return nodes;
}

export const MarkdownPaste = Extension.create<MarkdownPasteOptions>({
  name: "markdownPaste",

  addOptions() {
    return {
      onMarkdownDetected: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const opts = this.options;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(_view, event) {
            const manager = editor.markdown as MarkdownManager | undefined;
            if (!manager) return false;

            const html = event.clipboardData?.getData("text/html") ?? "";
            // 带真实富文本结构的 HTML 粘贴仍交给 ProseMirror 默认处理；
            // 纯文本样式的 HTML（只有段落/换行）按 Markdown 检测继续走
            if (html.trim() && RICH_HTML_RE.test(html)) return false;

            const text = event.clipboardData?.getData("text/plain") ?? "";
            if (!text.trim() || !looksLikeMarkdown(text)) return false;

            const actions: MarkdownPasteActions = {
              convert: () => {
                // 按顶层块逐块解析 + 逐块插入（不能用 insertContent(text, { contentType: "markdown" })，
                // 它对多块级内容会报 Invalid content for node doc）；
                // 某块解析/插入失败只影响该块：退回纯文本，其余块正常转换。
                // 每块显式定位插入点（不依赖光标）：插入表格等块后光标会留在
                // 单元格内，跟随光标会把后续内容嵌进表格
                let insertPos = editor.state.selection.from;
                for (const segment of splitMarkdownSegments(text)) {
                  let nodes: JSONNode[] = [];
                  try {
                    const parsed = manager.parse(segment);
                    const content =
                      parsed.type === "doc" && Array.isArray(parsed.content)
                        ? parsed.content
                        : [parsed];
                    nodes = sanitizeNodes(content as JSONNode[]);
                  } catch {
                    nodes = [];
                  }
                  if (!nodes.length) nodes = plainParagraphs(segment);
                  const sizeBefore = editor.state.doc.content.size;
                  let inserted = false;
                  try {
                    editor.commands.insertContentAt(insertPos, nodes);
                    inserted = true;
                  } catch {
                    try {
                      editor.commands.insertContentAt(insertPos, plainParagraphs(segment));
                      inserted = true;
                    } catch {
                      // 单块彻底失败时跳过，保证其余块继续转换
                    }
                  }
                  if (inserted) {
                    insertPos += editor.state.doc.content.size - sizeBefore;
                  }
                }
              },
              insertPlain: () => {
                editor.commands.insertContent(plainParagraphs(text));
              },
            };

            if (opts.onMarkdownDetected) {
              opts.onMarkdownDetected(text, actions);
            } else {
              actions.convert();
            }
            return true;
          },
        },
      }),
    ];
  },
});
