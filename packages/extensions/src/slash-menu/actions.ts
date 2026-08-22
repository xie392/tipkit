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
  /** 右侧预览面板的标题 */
  previewTitle?: string;
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
  /** 有值时"链接"走自定义弹窗（否则退化 window.prompt） */
  openLinkDialog?: () => void;
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
  openLinkDialog,
  clearSlashQuery = false,
}: GetInsertActionsOptions): InsertAction[] {
  const prepareInsert = () => {
    if (clearSlashQuery) replaceSlashWithEmpty(editor);
  };

  const heading = (level: 1 | 2 | 3 | 4): InsertAction => {
    const size = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 12;
    const titleMap = { 1: "大型章节标题", 2: "中型版块标题", 3: "小节标题", 4: "次级标题" } as const;
    return {
      id: `heading-${level}`,
      group: "基础",
      label: `标题 ${level}`,
      description: `${"#".repeat(level)} 章节标题`,
      aliases: [`h${level}`, `biaoti${level}`],
      icon: `Heading${level}`,
      shortcut: "#".repeat(level),
      available: true,
      previewTitle: titleMap[level],
      preview: `<div style="background:#fff;border-radius:6px;padding:12px"><div style="font-size:${size}px;font-weight:700;line-height:1.25;color:#111">标题 ${level} 示例</div><div style="margin-top:6px;height:6px;width:100%;border-radius:3px;background:#e5e7eb"></div><div style="margin-top:4px;height:6px;width:78%;border-radius:3px;background:#e5e7eb"></div></div>`,
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleHeading({ level }).run();
      },
    };
  };

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
      previewTitle: "普通段落",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="margin-top:6px;height:6px;width:100%;border-radius:3px;background:#e5e7eb"></div><div style="margin-top:6px;height:6px;width:60%;border-radius:3px;background:#e5e7eb"></div></div>',
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
      previewTitle: "无序列表",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项一</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项二</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项三</span></div></div>',
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
      previewTitle: "有序列表",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">1.</span><span style="font-size:11px;color:#4b5563">第一项内容</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">2.</span><span style="font-size:11px;color:#4b5563">第二项内容</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">3.</span><span style="font-size:11px;color:#4b5563">第三项内容</span></div></div>',
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
      previewTitle: "待办任务",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;background:#22c55e;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px">✓</span><span style="font-size:11px;color:#9ca3af;text-decoration:line-through">已完成任务</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid #d1d5db;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">待办任务一</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid #d1d5db;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">待办任务二</span></div></div>',
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
      previewTitle: "引用块",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="border-left:3px solid #111;padding-left:10px"><div style="font-size:11px;font-style:italic;line-height:1.6;color:#4b5563">真知无形，大音希声。这是一段引用的示例文本。</div></div></div>',
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
      previewTitle: "代码块",
      preview:
        '<div style="background:#111827;border-radius:6px;padding:12px;font-family:monospace;font-size:10px;line-height:1.7;color:#d1d5db"><div><span style="color:#a78bfa">const</span> <span style="color:#60a5fa">greet</span> = () =&gt; &#123;</div><div style="padding-left:12px"><span style="color:#9ca3af">// Hello</span></div><div style="padding-left:12px"><span style="color:#fcd34d">return</span> <span style="color:#34d399">"Hi"</span>;</div><div>&#125;;</div></div>',
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
      previewTitle: "表格",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:8px"><table style="border-collapse:collapse;width:100%;font-size:9px"><tr><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 A</th><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 B</th><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 C</th></tr><tr><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据1</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据2</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据3</td></tr><tr><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据4</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据5</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据6</td></tr></table></div>',
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
      previewTitle: "图片",
      preview:
        '<div style="background:#fff;border-radius:6px;overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:72px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div></div>',
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
      previewTitle: "链接",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center"><span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;padding:4px 8px;border-radius:6px;font-size:11px;color:#2563eb;text-decoration:underline">链接文字</span></div>',
      run: () => {
        prepareInsert();
        if (openLinkDialog) {
          openLinkDialog();
          return;
        }
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
      previewTitle: "多栏布局",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:10px;display:flex;gap:8px"><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="height:6px;width:72%;border-radius:3px;background:#e5e7eb"></div></div><div style="width:1px;background:#e5e7eb"></div><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="height:6px;width:64%;border-radius:3px;background:#e5e7eb"></div></div></div>',
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
      previewTitle: "折叠块",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 12 12" width="10" height="10" fill="#6b7280"><path d="M4 2l4 4-4 4z"/></svg><span style="font-size:11px;font-weight:500;color:#374151">点击展开 / 收起</span></div>',
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
      previewTitle: "页面目录",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px"><span style="width:5px;height:5px;border-radius:50%;background:#9ca3af"></span><span style="height:5px;width:64px;border-radius:3px;background:#d1d5db"></span></div><div style="display:flex;align-items:center;gap:8px;padding-left:12px"><span style="width:4px;height:4px;border-radius:50%;background:#d1d5db"></span><span style="height:5px;width:48px;border-radius:3px;background:#e5e7eb"></span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:5px;height:5px;border-radius:50%;background:#9ca3af"></span><span style="height:5px;width:80px;border-radius:3px;background:#d1d5db"></span></div></div>',
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
      previewTitle: "提示框",
      preview:
        '<div style="display:flex;gap:8px;border-radius:6px;background:#fffbeb;padding:10px"><span style="font-size:14px">💡</span><div style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:11px;font-weight:500;color:#92400e">提示</span><span style="height:5px;width:100%;border-radius:3px;background:#fde68a"></span><span style="height:5px;width:72%;border-radius:3px;background:#fde68a"></span></div></div>',
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
      previewTitle: "数学公式",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center"><span style="font-size:18px;font-style:italic;color:#111;font-family:Georgia,serif">E = mc²</span></div>',
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
      previewTitle: "嵌入网页",
      preview:
        '<div style="background:#fff;border-radius:6px;overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:64px;background:#f3f4f6"><span style="font-size:10px;color:#9ca3af">🔗 外部网页</span></div></div>',
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
      previewTitle: "附件",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:6px;padding:8px"><span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#fef2f2;font-size:10px;font-weight:700;color:#ef4444">PDF</span><span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="height:5px;width:80px;border-radius:3px;background:#d1d5db"></span><span style="height:4px;width:40px;border-radius:2px;background:#e5e7eb"></span></span></div></div>',
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
      previewTitle: "Emoji 表情",
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:20px">😀</span><span style="font-size:20px">🎉</span><span style="font-size:20px">❤️</span><span style="font-size:20px">🔥</span><span style="font-size:20px">✨</span></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().insertContent(":").run();
      },
    },
  ];
}
