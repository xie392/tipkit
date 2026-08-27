import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { IconRef, Translate } from "@tipkit/core";

/* 斜杠菜单命令列表（迁移自 blog rich-text/insert-actions.tsx）。
 * 视觉剥离：icon 用 lucide 图标名（IconRef），由消费方映射渲染；
 * 命令逻辑保持与 blog 一致（getSlashCommandState / filterInsertActions）。 */

export interface InsertAction {
  id: string;
  group: "basic" | "structure" | "media";
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

/** 检测光标前是否为 "/关键词"（段落内生效，支持 blockquote / callout / listItem / column / details 等嵌套容器内的段落） */
export function getSlashCommandState(editor: Editor): SlashCommandState {
  const { state } = editor;
  const { $anchor, empty } = state.selection;

  if (!empty) return INACTIVE_SLASH_COMMAND;

  const node = $anchor.parent;
  if (node.type.name !== "paragraph") return INACTIVE_SLASH_COMMAND;

  const textBeforeCursor = node.textBetween(0, $anchor.parentOffset, "\n", "\n");
  if (!textBeforeCursor.startsWith("/")) return INACTIVE_SLASH_COMMAND;

  const query = textBeforeCursor.slice(1);
  const from = $anchor.start();
  const to = from + textBeforeCursor.length;

  return { active: true, query, from, to, key: `${from}:${to}:${query}` };
}

/** 执行动作前删除 "/关键词" 文本（slash 菜单用）。
 *  删除后若当前段落为空，将选区设为 NodeSelection 选中该空段落，
 *  这样后续 insertContent 会替换整块而非在空段落后追加，避免多一行。 */
export function replaceSlashWithEmpty(editor: Editor) {
  const slash = getSlashCommandState(editor);
  if (!slash.active) return;
  const { state, view } = editor;
  const tr = state.tr.deleteRange(slash.from, slash.to);
  const $from = tr.doc.resolve(slash.from);
  if ($from.parent.type.name === "paragraph" && $from.parent.content.size === 0) {
    const nodePos = $from.before($from.depth);
    if (nodePos >= 0) {
      tr.setSelection(NodeSelection.create(tr.doc, nodePos));
    }
  }
  view.dispatch(tr.scrollIntoView());
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
  /** i18n 翻译函数 */
  t?: Translate;
}

/** 斜杠菜单分组排序 key */
export const SLASH_GROUP_ORDER: InsertAction["group"][] = ["basic", "structure", "media"];

/** 分组 key → i18n key 映射 */
const GROUP_LABEL_KEY: Record<InsertAction["group"], string> = {
  basic: "slash.group.basic",
  structure: "slash.group.structure",
  media: "slash.group.media",
};

/** 获取分组本地化标题 */
export function getSlashGroupLabel(group: InsertAction["group"], t: Translate): string {
  return t(GROUP_LABEL_KEY[group]);
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
  t,
}: GetInsertActionsOptions): InsertAction[] {
  const tr = t ?? ((k: string) => k);
  const prepareInsert = () => {
    if (clearSlashQuery) replaceSlashWithEmpty(editor);
  };

  const inTable = editor.isActive("table");

  const heading = (level: 1 | 2 | 3 | 4): InsertAction => {
    const size = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 12;
    return {
      id: `heading-${level}`,
      group: "basic",
      label: tr(`slash.heading${level}.label`),
      description: tr(`slash.heading${level}.description`),
      aliases: [`h${level}`, `biaoti${level}`],
      icon: `Heading${level}`,
      shortcut: "#".repeat(level),
      available: true,
      previewTitle: tr(`slash.heading${level}.previewTitle`),
      preview: `<div style="background:#fff;border-radius:6px;padding:12px"><div style="font-size:${size}px;font-weight:700;line-height:1.25;color:#111">${tr(`slash.heading${level}.label`)}</div><div style="margin-top:6px;height:6px;width:100%;border-radius:3px;background:#e5e7eb"></div><div style="margin-top:4px;height:6px;width:78%;border-radius:3px;background:#e5e7eb"></div></div>`,
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
      group: "basic",
      label: tr("slash.paragraph.label"),
      description: tr("slash.paragraph.description"),
      aliases: ["zhengwen", "p"],
      icon: "Text",
      available: true,
      previewTitle: tr("slash.paragraph.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="margin-top:6px;height:6px;width:100%;border-radius:3px;background:#e5e7eb"></div><div style="margin-top:6px;height:6px;width:60%;border-radius:3px;background:#e5e7eb"></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setParagraph().run();
      },
    },
    {
      id: "bulletList",
      group: "basic",
      label: tr("slash.bulletList.label"),
      description: tr("slash.bulletList.description"),
      aliases: ["wuxu", "ul", "list"],
      icon: "List",
      shortcut: "- ",
      available: true,
      previewTitle: tr("slash.bulletList.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项一</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项二</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">列表项三</span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleBulletList().run();
      },
    },
    {
      id: "orderedList",
      group: "basic",
      label: tr("slash.orderedList.label"),
      description: tr("slash.orderedList.description"),
      aliases: ["youxu", "ol", "list"],
      icon: "ListOrdered",
      shortcut: "1. ",
      available: true,
      previewTitle: tr("slash.orderedList.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">1.</span><span style="font-size:11px;color:#4b5563">第一项内容</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">2.</span><span style="font-size:11px;color:#4b5563">第二项内容</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:#6b7280">3.</span><span style="font-size:11px;color:#4b5563">第三项内容</span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      id: "taskList",
      group: "basic",
      label: tr("slash.taskList.label"),
      description: tr("slash.taskList.description"),
      aliases: ["renwu", "todo", "check"],
      icon: "ListChecks",
      shortcut: "[] ",
      available: true,
      previewTitle: tr("slash.taskList.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;background:#22c55e;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px">✓</span><span style="font-size:11px;color:#9ca3af;text-decoration:line-through">已完成任务</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid #d1d5db;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">待办任务一</span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid #d1d5db;flex-shrink:0"></span><span style="font-size:11px;color:#4b5563">待办任务二</span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleTaskList().run();
      },
    },
    {
      id: "status",
      group: "basic",
      label: tr("slash.status.label"),
      description: tr("slash.status.description"),
      aliases: ["zhuangtai", "status", "label"],
      icon: "Badge",
      available: true,
      previewTitle: tr("slash.status.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center"><span style="display:inline-block;background:#ffcccc;border-radius:4px;padding:2px 8px;font-size:11px;color:#111">待处理</span></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setStatus().run();
      },
    },
    {
      id: "blockquote",
      group: "basic",
      label: tr("slash.blockquote.label"),
      description: tr("slash.blockquote.description"),
      aliases: ["yinyong", "quote", "blockquote"],
      icon: "Quote",
      shortcut: "> ",
      available: true,
      previewTitle: tr("slash.blockquote.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="border-left:3px solid #111;padding-left:10px"><div style="font-size:11px;font-style:italic;line-height:1.6;color:#4b5563">真知无形，大音希声。这是一段引用的示例文本。</div></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      id: "codeBlock",
      group: "structure",
      label: tr("slash.codeBlock.label"),
      description: tr("slash.codeBlock.description"),
      aliases: ["daima", "code", "pre"],
      icon: "Code2",
      shortcut: "```",
      available: true,
      previewTitle: tr("slash.codeBlock.previewTitle"),
      preview:
        '<div style="background:#111827;border-radius:6px;padding:12px;font-family:monospace;font-size:10px;line-height:1.7;color:#d1d5db"><div><span style="color:#a78bfa">const</span> <span style="color:#60a5fa">greet</span> = () =&gt; &#123;</div><div style="padding-left:12px"><span style="color:#9ca3af">// Hello</span></div><div style="padding-left:12px"><span style="color:#fcd34d">return</span> <span style="color:#34d399">"Hi"</span>;</div><div>&#125;;</div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      id: "table",
      group: "structure",
      label: tr("slash.table.label"),
      description: inTable ? tr("slash.table.descriptionInTable") : tr("slash.table.description"),
      aliases: ["biaoge", "table"],
      icon: "Table2",
      available: !inTable,
      previewTitle: tr("slash.table.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:8px"><table style="border-collapse:collapse;width:100%;font-size:9px"><tr><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 A</th><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 B</th><th style="border:1px solid #e5e7eb;padding:4px 6px;background:#f9fafb;text-align:left;color:#6b7280">列 C</th></tr><tr><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据1</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据2</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据3</td></tr><tr><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据4</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据5</td><td style="border:1px solid #f3f4f6;padding:4px 6px;color:#6b7280">数据6</td></tr></table></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      id: "image",
      group: "media",
      label: tr("slash.image.label"),
      description: tr("slash.image.description"),
      aliases: ["tupian", "image", "img", "upload"],
      icon: "Image",
      available: true,
      previewTitle: tr("slash.image.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:72px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div></div>',
      run: () => {
        prepareInsert();
        if (openImagePicker) {
          openImagePicker();
          return;
        }
        const url = window.prompt(tr("toolbar.imagePrompt"));
        if (!url) return;
        editor.chain().focus().setImageBlock({ src: url }).run();
      },
    },
    {
      id: "link",
      group: "basic",
      label: tr("slash.link.label"),
      description: tr("slash.link.description"),
      aliases: ["lianjie", "link", "href"],
      icon: "Link",
      available: true,
      previewTitle: tr("slash.link.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center"><span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;padding:4px 8px;border-radius:6px;font-size:11px;color:#2563eb;text-decoration:underline">链接文字</span></div>',
      run: () => {
        prepareInsert();
        if (openLinkDialog) {
          openLinkDialog();
          return;
        }
        const href = window.prompt(tr("toolbar.linkPrompt"));
        if (!href) return;
        editor.chain().focus().setLink({ href }).run();
      },
    },
    /* ── 高级节点（M3 已实现） ─────────────────────────────────── */
    {
      id: "columns",
      group: "structure",
      label: tr("slash.columns.label"),
      description: tr("slash.columns.description"),
      aliases: ["fenlan", "columns", "col"],
      icon: "Columns2",
      available: true,
      previewTitle: tr("slash.columns.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:10px;display:flex;gap:8px"><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="height:6px;width:72%;border-radius:3px;background:#e5e7eb"></div></div><div style="width:1px;background:#e5e7eb"></div><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:6px;width:100%;border-radius:3px;background:#d1d5db"></div><div style="height:6px;width:64%;border-radius:3px;background:#e5e7eb"></div></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setColumns().run();
      },
    },
    {
      id: "details",
      group: "structure",
      label: tr("slash.details.label"),
      description: tr("slash.details.description"),
      aliases: ["zhedie", "details", "collapse"],
      icon: "ChevronDownSquare",
      available: true,
      previewTitle: tr("slash.details.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 12 12" width="10" height="10" fill="#6b7280"><path d="M4 2l4 4-4 4z"/></svg><span style="font-size:11px;font-weight:500;color:#374151">点击展开 / 收起</span></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setDetails().run();
      },
    },
    {
      id: "toc",
      group: "media",
      label: tr("slash.toc.label"),
      description: tr("slash.toc.description"),
      aliases: ["mulu", "outline", "catalog"],
      icon: "ListTree",
      available: true,
      previewTitle: tr("slash.toc.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px"><span style="width:5px;height:5px;border-radius:50%;background:#9ca3af"></span><span style="height:5px;width:64px;border-radius:3px;background:#d1d5db"></span></div><div style="display:flex;align-items:center;gap:8px;padding-left:12px"><span style="width:4px;height:4px;border-radius:50%;background:#d1d5db"></span><span style="height:5px;width:48px;border-radius:3px;background:#e5e7eb"></span></div><div style="display:flex;align-items:center;gap:8px"><span style="width:5px;height:5px;border-radius:50%;background:#9ca3af"></span><span style="height:5px;width:80px;border-radius:3px;background:#d1d5db"></span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().insertTableOfContents().run();
      },
    },
    {
      id: "callout",
      group: "media",
      label: tr("slash.callout.label"),
      description: tr("slash.callout.description"),
      aliases: ["tishi", "callout", "alert"],
      icon: "TriangleAlert",
      available: true,
      previewTitle: tr("slash.callout.previewTitle"),
      preview:
        '<div style="display:flex;gap:8px;border-radius:6px;background:#fffbeb;padding:10px"><span style="font-size:14px">💡</span><div style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:11px;font-weight:500;color:#92400e">提示</span><span style="height:5px;width:100%;border-radius:3px;background:#fde68a"></span><span style="height:5px;width:72%;border-radius:3px;background:#fde68a"></span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setCallout().run();
      },
    },
    {
      id: "katex",
      group: "media",
      label: tr("slash.katex.label"),
      description: tr("slash.katex.description"),
      aliases: ["gongshi", "math", "latex"],
      icon: "Sigma",
      available: true,
      previewTitle: tr("slash.katex.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center"><span style="font-size:18px;font-style:italic;color:#111;font-family:Georgia,serif">E = mc²</span></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setKatex({ text: "" }).run();
      },
    },
    {
      id: "iframe",
      group: "media",
      label: tr("slash.iframe.label"),
      description: tr("slash.iframe.description"),
      aliases: ["qianru", "embed", "video"],
      icon: "Frame",
      available: true,
      previewTitle: tr("slash.iframe.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:64px;background:#f3f4f6"><span style="font-size:10px;color:#9ca3af">🔗 外部网页</span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setIframe({ url: null }).run();
      },
    },
    {
      id: "attachment",
      group: "media",
      label: tr("slash.attachment.label"),
      description: tr("slash.attachment.description"),
      aliases: ["fujian", "file", "upload"],
      icon: "Paperclip",
      available: true,
      previewTitle: tr("slash.attachment.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:12px"><div style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:6px;padding:8px"><span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#fef2f2;font-size:10px;font-weight:700;color:#ef4444">PDF</span><span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="height:5px;width:80px;border-radius:3px;background:#d1d5db"></span><span style="height:4px;width:40px;border-radius:2px;background:#e5e7eb"></span></span></div></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().setAttachment().run();
      },
    },
    {
      id: "emoji",
      group: "media",
      label: tr("slash.emoji.label"),
      description: tr("slash.emoji.description"),
      aliases: ["biaoqing", "face", "smile"],
      icon: "Smile",
      available: true,
      previewTitle: tr("slash.emoji.previewTitle"),
      preview:
        '<div style="background:#fff;border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:20px">😀</span><span style="font-size:20px">🎉</span><span style="font-size:20px">❤️</span><span style="font-size:20px">🔥</span><span style="font-size:20px">✨</span></div>',
      run: () => {
        prepareInsert();
        editor.chain().focus().insertContent(":").run();
      },
    },
  ];
}
