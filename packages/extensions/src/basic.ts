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
import Focus from "@tiptap/extension-focus";
import { Markdown } from "@tiptap/markdown";

import { CustomBold, CustomItalic, CustomStrike, CustomCode } from "./markdown/marks";
import { MarkdownLink } from "./markdown/link";
import { MarkdownPaste } from "./markdown/paste";
import { ListInputRules } from "./markdown/list-input-rules";
import { TrailingNode } from "./basic/trailing-node";
import { Selection } from "./basic/selection";
import { FontSize } from "./basic/font-size";

/* TipKit 基础扩展集合（M1：基础格式 + markdown 输入规则 + 序列化）。
 * 编排方式对齐 blog use-editor.ts 的 M1 范围；高级节点（图片块/斜杠菜单/
 * katex/附件/分栏/TOC 等）在 M2/M3 按需引入，不在此集合内。
 *
 * 消费方组合方式：
 *   useTipKitEditor({ extensions: createBasicExtensions() })
 * 或追加高级扩展：
 *   useTipKitEditor({ extensions: [...createBasicExtensions(), ImageBlock, Katex] })
 */
export function createBasicExtensions(): AnyExtension[] {
  if (cachedBasic) return cachedBasic;
  cachedBasic = buildBasicExtensions();
  return cachedBasic;
}

let cachedBasic: AnyExtension[] | null = null;

function buildBasicExtensions(): AnyExtension[] {
  return [
    // StarterKit：禁用内置 Bold/Italic/Strike/Code（用下方自定义版，
    // 规避 Tiptap 3.x markInputRule 的 addMark 崩溃 bug）。
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      bold: false,
      italic: false,
      strike: false,
      code: false,
      link: false,
      underline: false,
      trailingNode: false,
      dropcursor: false,
    }),
    // 行内 markdown 输入规则（safeMarkInputRule 规避崩溃）
    CustomBold,
    CustomItalic,
    CustomStrike,
    CustomCode,
    // 行内/块级基础
    Underline,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Typography,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    // 列表 / 任务
    TaskList,
    TaskItem.configure({ nested: true }),
    // 表格
    Table.configure({ resizable: true, lastColumnResizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // 链接（markdown 输入规则 + 自动链接）
    MarkdownLink,
    // markdown 粘贴 / 序列化
    Markdown,
    MarkdownPaste,
    // 编辑器体验（对齐 blog use-editor.ts）
    TrailingNode,
    Selection,
    ListInputRules,
    CharacterCount.configure({ limit: 100000 }),
    Dropcursor.configure({ width: 2 }),
    Focus.configure({ mode: "all" }),
  ];
}
