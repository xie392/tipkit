import type { Editor } from "@tiptap/react";
import type { IconRef } from "@tipkit/core";

/* 斜杠菜单命令列表（迁移自 blog rich-text/insert-actions.tsx）。
 * 视觉剥离：icon 用 lucide 图标名（IconRef），由消费方映射渲染；
 * 命令逻辑保持与 blog 一致（getSlashCommandState / filterInsertActions）。 */

export interface InsertAction {
  id: string;
  group: "基础" | "结构" | "媒体";
  label: string;
  description: string;
  aliases?: string[];
  /** lucide 图标名，消费方映射 */
  icon: IconRef;
  shortcut?: string;
  run: () => void;
  /** false 表示命令依赖尚未迁移的扩展（M3），菜单中仍可展示但禁用 */
  available: boolean;
  /** 右侧预览面板的 HTML（内联样式，消费方也可忽略） */
  preview?: string;
}

export interface SlashCommandState {
  active: boolean;
  query: string;
  from: number;
  to: number;
  key: string;
}

const INACTIVE_SLASH_COMMAND: SlashCommandState = {
  active: false,
  query: "",
  from: 0,
  to: 0,
  key: "",
};

/** 检测光标前是否为 "/关键词"（仅段落内生效） */
export function getSlashCommandState(editor: Editor): SlashCommandState {
  const { state } = editor;
  const { $anchor, empty } = state.selection;

  if (!empty || $anchor.depth !== 1) return INACTIVE_SLASH_COMMAND;

  const node = $anchor.parent;
  if (node.type.name !== "paragraph") return INACTIVE_SLASH_COMMAND;

  const textBeforeCursor = node.textBetween(0, $anchor.parentOffset, "\n", "\n");
  if (!textBeforeCursor.startsWith("/")) return INACTIVE_SLASH_COMMAND;

  const query = textBeforeCursor.slice(1);
  const from = $anchor.start();
  const to = from + textBeforeCursor.length;

  return { active: true, query, from, to, key: `${from}:${to}:${query}` };
}

/** 执行动作前删除 "/关键词" 文本（slash 菜单用） */
export function replaceSlashWithEmpty(editor: Editor) {
  const slash = getSlashCommandState(editor);
  if (!slash.active) return;
  editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
}

export function filterInsertActions(actions: InsertAction[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return actions;
  const isSingleCjkQuery = normalizedQuery.length === 1 && /[一-鿿]/.test(normalizedQuery);

  return actions.filter((action) => {
    const label = action.label.toLowerCase();
    const aliases = action.aliases ?? [];

    if (isSingleCjkQuery) {
      return (
        label.startsWith(normalizedQuery) ||
        aliases.some((alias) => alias.toLowerCase() === normalizedQuery)
      );
    }

    const haystack = [label, action.description, action.id, ...aliases]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export interface GetInsertActionsOptions {
  editor: Editor;
  /** 有值时"图片"走本地文件选择 */
  openImagePicker?: () => void;
  /** 执行动作前删除 "/关键词" 文本（slash 菜单用） */
  clearSlashQuery?: boolean;
}

/**
 * 生成插入命令列表。
 * M2 可用：标题/正文/列表/引用/代码块/图片/表格/链接；
 * M3 待启用（available: false）：分栏/折叠/目录/提示框/嵌入/公式/附件/emoji。
 */
export function getInsertActions({
  editor,
  openImagePicker,
  clearSlashQuery = false,
}: GetInsertActionsOptions): InsertAction[] {
  const prepareInsert = () => {
    if (clearSlashQuery) replaceSlashWithEmpty(editor);
  };

  const heading = (level: 1 | 2 | 3 | 4): InsertAction => ({
    id: `heading-${level}`,
    group: "基础",
    label: `标题 ${level}`,
    description: `${"#".repeat(level)} 章节标题`,
    aliases: [`h${level}`, `biaoti${level}`],
    icon: `Heading${level}`,
    shortcut: "#".repeat(level),
    available: true,
    preview: `<h${level} style="margin:0;color:inherit">标题 ${level} 示例</h${level}>`,
    run: () => {
      prepareInsert();
      editor.chain().focus().toggleHeading({ level }).run();
    },
  });

  return [
    heading(1),
    heading(2),
    heading(3),
    heading(4),
    {
      id: "paragraph",
      group: "基础",
      label: "正文",
      description: "普通段落",
      aliases: ["zhengwen", "p"],
      icon: "Text",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setParagraph().run();
      },
    },
    {
      id: "bulletList",
      group: "基础",
      label: "无序列表",
      description: "项目符号列表",
      aliases: ["wuxu", "ul", "list"],
      icon: "List",
      shortcut: "- ",
      available: true,
      preview:
        '<ul style="margin:0;padding-left:18px"><li>项目一</li><li>项目二</li><li>项目三</li></ul>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleBulletList().run();
      },
    },
    {
      id: "orderedList",
      group: "基础",
      label: "有序列表",
      description: "数字编号列表",
      aliases: ["youxu", "ol", "list"],
      icon: "ListOrdered",
      shortcut: "1. ",
      available: true,
      preview:
        '<ol style="margin:0;padding-left:18px"><li>第一步</li><li>第二步</li><li>第三步</li></ol>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      id: "taskList",
      group: "基础",
      label: "任务列表",
      description: "带复选框的待办事项",
      aliases: ["renwu", "todo", "check"],
      icon: "ListChecks",
      shortcut: "[] ",
      available: true,
      preview:
        '<ul style="margin:0;padding-left:18px;list-style:none"><li>☐ 待办事项 A</li><li>☑ 已完成事项 B</li></ul>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleTaskList().run();
      },
    },
    {
      id: "blockquote",
      group: "基础",
      label: "引用",
      description: "块引用",
      aliases: ["yinyong", "quote", "blockquote"],
      icon: "Quote",
      shortcut: "> ",
      available: true,
      preview:
        '<blockquote style="margin:0;padding:6px 10px;border-left:3px solid #999;color:#555;background:#f7f7f7;border-radius:0 6px 6px 0">引用一段话，强调观点来源</blockquote>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      id: "codeBlock",
      group: "结构",
      label: "代码块",
      description: "带语法高亮的代码段",
      aliases: ["daima", "code", "pre"],
      icon: "Code2",
      shortcut: "```",
      available: true,
      preview:
        '<pre style="margin:0;padding:10px;background:#1e1e1e;color:#d4d4d4;border-radius:6px;font-size:12px;font-family:monospace"><span style="color:#569cd6">const</span> greet = <span style="color:#ce9178">"hello"</span>;<br/>console.log(greet);</pre>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      id: "table",
      group: "结构",
      label: "表格",
      description: "插入 3×3 表格",
      aliases: ["biaoge", "table"],
      icon: "Table2",
      available: true,
      preview:
        '<table style="border-collapse:collapse;width:100%;font-size:11px"><tr><th style="border:1px solid #ccc;padding:4px">表头 A</th><th style="border:1px solid #ccc;padding:4px">表头 B</th></tr><tr><td style="border:1px solid #ccc;padding:4px">1</td><td style="border:1px solid #ccc;padding:4px">2</td></tr></table>',
      run: () => {
        prepareInsert();
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      id: "image",
      group: "媒体",
      label: "图片",
      description: "插入图片（上传或链接）",
      aliases: ["tupian", "image", "img", "upload"],
      icon: "Image",
      available: true,
      preview:
        '<div style="display:flex;align-items:center;justify-content:center;height:80px;border:1px dashed #ccc;border-radius:8px;color:#999;font-size:12px">🖼 图片预览占位</div>',
      run: () => {
        prepareInsert();
        if (openImagePicker) {
          openImagePicker();
          return;
        }
        const url = window.prompt("图片链接（https://…）");
        if (!url) return;
        editor.chain().focus().setImageBlock({ src: url }).run();
      },
    },
    {
      id: "link",
      group: "基础",
      label: "链接",
      description: "为选中文字添加链接",
      aliases: ["lianjie", "link", "href"],
      icon: "Link",
      available: true,
      run: () => {
        prepareInsert();
        const href = window.prompt("链接地址（https://…）");
        if (!href) return;
        editor.chain().focus().setLink({ href }).run();
      },
    },
    /* ── 高级节点（M3 已实现） ─────────────────────────────────── */
    {
      id: "columns",
      group: "结构",
      label: "分栏",
      description: "两栏布局",
      aliases: ["fenlan", "columns", "col"],
      icon: "Columns2",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setColumns().run();
      },
    },
    {
      id: "details",
      group: "结构",
      label: "折叠块",
      description: "可展开收起的详情块",
      aliases: ["zhedie", "details", "collapse"],
      icon: "ChevronDownSquare",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setDetails().run();
      },
    },
    {
      id: "toc",
      group: "媒体",
      label: "页面目录",
      description: "自动扫描标题生成目录",
      aliases: ["mulu", "outline", "catalog"],
      icon: "ListTree",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().insertTableOfContents().run();
      },
    },
    {
      id: "callout",
      group: "媒体",
      label: "提示框",
      description: "高亮信息 / 警告 / 备注",
      aliases: ["tishi", "callout", "alert"],
      icon: "TriangleAlert",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setCallout().run();
      },
    },
    {
      id: "katex",
      group: "媒体",
      label: "数学公式",
      description: "LaTeX 公式（块级）",
      aliases: ["gongshi", "math", "latex"],
      icon: "Sigma",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setKatex({ text: "" }).run();
      },
    },
    {
      id: "iframe",
      group: "媒体",
      label: "嵌入网页",
      description: "B 站 / YouTube / 外部网页",
      aliases: ["qianru", "embed", "video"],
      icon: "Frame",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setIframe({ url: null }).run();
      },
    },
    {
      id: "attachment",
      group: "媒体",
      label: "附件",
      description: "上传文件并预览（PDF / Office / 压缩包等）",
      aliases: ["fujian", "file", "upload"],
      icon: "Paperclip",
      available: true,
      run: () => {
        prepareInsert();
        editor.chain().focus().setAttachment().run();
      },
    },
    {
      id: "emoji",
      group: "媒体",
      label: "插入 emoji",
      description: "输入 : 触发或点此浏览",
      aliases: ["biaoqing", "face", "smile"],
      icon: "Smile",
      available: true,
      run: () => {
        prepareInsert();
        // 在光标处插入 : 触发 emoji 建议
        editor.chain().focus().insertContent(":").run();
      },
    },
  ];
}
