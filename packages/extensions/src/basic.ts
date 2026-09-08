import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Markdown } from "@tiptap/markdown";

import { CustomBold, CustomItalic, CustomStrike, CustomCode } from "./markdown/marks";
import { MarkdownLink } from "./markdown/link";
import { LinkBackfillConvert } from "./markdown/link-backfill-convert";
import { CodeBackfillConvert } from "./markdown/code-backfill-convert";
import { MarkBackfillConvert } from "./markdown/mark-backfill-convert";
import { MarkdownPaste } from "./markdown/paste";
import { UrlAutolink } from "./markdown/url-autolink";
import { ListInputRules } from "./markdown/list-input-rules";
import { TrailingNode } from "./basic/trailing-node";
import { Selection } from "./basic/selection";
import { SelectAll } from "./basic/select-all";
import { FontSize } from "./basic/font-size";
import { CustomHorizontalRule } from "./basic/horizontal-rule";
import { CustomHeading } from "./basic/heading";
import { TableReadonlyResize } from "./table-readonly-resize/table-readonly-resize";

/** 基础集合内每个扩展的稳定 key（按加入顺序排列） */
export type BasicExtensionKey =
  | "starterKit"
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "underline"
  | "highlight"
  | "subscript"
  | "superscript"
  | "textStyle"
  | "color"
  | "fontFamily"
  | "fontSize"
  | "typography"
  | "textAlign"
  | "horizontalRule"
  | "taskList"
  | "taskItem"
  | "table"
  | "tableRow"
  | "tableHeader"
  | "tableCell"
  | "tableReadonlyResize"
  | "markdownLink"
  | "linkBackfillConvert"
  | "codeBackfillConvert"
  | "markBackfillConvert"
  | "markdown"
  | "markdownPaste"
  | "urlAutolink"
  | "trailingNode"
  | "selection"
  | "selectAll"
  | "listInputRules"
  | "heading"
  | "characterCount"
  | "dropcursor";

export interface BasicExtensionsOptions {
  /** 用消费方自己的扩展实例替换集合中的默认项（如换成自研 CodeBlock） */
  replace?: Partial<Record<BasicExtensionKey, AnyExtension>>;
  /** 从集合中移除某些扩展 */
  omit?: BasicExtensionKey[];
  /** 追加到集合末尾的扩展 */
  extra?: AnyExtension[];
}

/* TipKit 基础扩展集合（M1：基础格式 + markdown 输入规则 + 序列化）。
 * 编排方式对齐 blog use-editor.ts 的 M1 范围；高级节点（图片块/斜杠菜单/
 * katex/附件/分栏/TOC 等）在 M2/M3 按需引入，不在此集合内。
 *
 * 消费方组合方式：
 *   useTipKitEditor({ extensions: createBasicExtensions() })
 * 或追加高级扩展：
 *   useTipKitEditor({ extensions: [...createBasicExtensions(), ImageBlock, Katex] })
 * 或替换 / 裁剪集合内默认项：
 *   createBasicExtensions({
 *     replace: { codeBlock: MyCodeBlock },
 *     omit: ["typography"],
 *     extra: [MyExtension],
 *   })
 */
export function createBasicExtensions(options: BasicExtensionsOptions = {}): AnyExtension[] {
  const { replace = {}, omit = [], extra = [] } = options;
  const built = buildBasicExtensions();
  // 替换项沿用原 key 的位置，保证扩展注册顺序不变
  for (const key of Object.keys(replace) as BasicExtensionKey[]) {
    const ext = replace[key];
    if (ext) built[key] = ext;
  }
  for (const key of omit) delete built[key];
  return [...Object.values(built), ...extra];
}

function buildBasicExtensions(): Record<BasicExtensionKey, AnyExtension> {
  return {
    // StarterKit：禁用内置 Bold/Italic/Strike/Code（用下方自定义版，
    // 规避 Tiptap 3.x markInputRule 的 addMark 崩溃 bug）。
    starterKit: StarterKit.configure({
      // heading 由下方 CustomHeading 替换（保证 input rule 注册顺序更晚，作为兜底）
      heading: false,
      codeBlock: false,
      bold: false,
      italic: false,
      strike: false,
      code: false,
      link: false,
      underline: false,
      trailingNode: false,
      dropcursor: false,
      horizontalRule: false,
    }),
    // 行内 markdown 输入规则（safeMarkInputRule 规避崩溃）
    bold: CustomBold,
    italic: CustomItalic,
    strike: CustomStrike,
    code: CustomCode,
    // 行内/块级基础
    underline: Underline,
    highlight: Highlight.configure({ multicolor: true }),
    subscript: Subscript,
    superscript: Superscript,
    textStyle: TextStyle,
    color: Color,
    fontFamily: FontFamily,
    fontSize: FontSize,
    typography: Typography,
    textAlign: TextAlign.configure({ types: ["heading", "paragraph"] }),
    // 分隔线：可交互包裹（块手柄 / 块操作菜单可命中）
    horizontalRule: CustomHorizontalRule,
    // 列表 / 任务
    taskList: TaskList,
    taskItem: TaskItem.configure({ nested: true }),
    // 表格
    table: Table.configure({ resizable: true, lastColumnResizable: false }),
    tableRow: TableRow,
    tableHeader: TableHeader,
    tableCell: TableCell,
    // 只读列宽拖拽（内置 columnResizing 仅编辑态生效）
    tableReadonlyResize: TableReadonlyResize,
    // 链接（markdown 输入规则 + 自动链接）
    markdownLink: MarkdownLink,
    // 链接回填转换：IME 组合输入等场景下 [文字](url) 兜底转链接
    linkBackfillConvert: LinkBackfillConvert,
    // 行内代码回填转换：`code` 在空格/回车时兜底转 code mark
    codeBackfillConvert: CodeBackfillConvert,
    // 行内 mark 回填转换：**bold** / *italic* / ~~strike~~ 在空格/回车时兜底转换
    markBackfillConvert: MarkBackfillConvert,
    // markdown 粘贴 / 序列化
    markdown: Markdown,
    markdownPaste: MarkdownPaste,
    // 裸 URL 识别：收紧 marked 内置规则，避免吞掉中文/全角标点
    urlAutolink: UrlAutolink,
    // 编辑器体验（对齐 blog use-editor.ts）
    trailingNode: TrailingNode,
    selection: Selection,
    selectAll: SelectAll,
    listInputRules: ListInputRules,
    // 自定义 Heading：input rule 在所有基础规则之后注册，作为最后兜底，
    // 修复段尾回车后首个空段上输入 `## ` 偶发不转标题的问题
    heading: CustomHeading,
    characterCount: CharacterCount.configure({ limit: 100000 }),
    dropcursor: Dropcursor.configure({ width: 2 }),
  };
}
