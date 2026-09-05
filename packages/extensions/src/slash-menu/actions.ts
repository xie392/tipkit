import type { Translate } from "@tipkit/core";
import { replaceSlashWithEmpty } from "./state";
import type { GetInsertActionsOptions, InsertAction } from "./types";
import * as pv from "./preview";

/* 斜杠菜单命令列表（迁移自 blog rich-text/insert-actions.tsx）。
 * 视觉剥离：icon 用 lucide 图标名（IconRef），预览 HTML 只用主题 CSS 变量。 */

export type { GetInsertActionsOptions, InsertAction, SlashCommandState } from "./types";
export { SLASH_GROUP_ORDER, getSlashGroupLabel } from "./types";
export { getSlashCommandState, replaceSlashWithEmpty, filterInsertActions } from "./state";

/** 生成插入命令列表（各扩展命令的可用性与消费方注册的扩展保持一致）。 */
export function getInsertActions({
  editor,
  openImagePicker,
  openLinkDialog,
  clearSlashQuery = false,
  t,
  aiEnabled = false,
}: GetInsertActionsOptions): InsertAction[] {
  const tr: Translate = t ?? ((k: string) => k);
  const prepareInsert = () => {
    if (clearSlashQuery) replaceSlashWithEmpty(editor);
  };

  const inTable = editor.isActive("table");

  const aiAction: InsertAction = {
    id: "ai",
    group: "basic",
    label: tr("slash.ai.label"),
    description: tr("slash.ai.description"),
    aliases: ["ai", "zhineng", "aizhushou", "assistant"],
    icon: "Sparkles",
    available: true,
    previewTitle: tr("slash.ai.previewTitle"),
    preview: pv.previewAI(),
    run: () => {
      prepareInsert();
      // 打开 AI 助手浮层（AiMenu 在 editor.view.dom 上监听）
      editor.view.dom.dispatchEvent(new CustomEvent("tk-ai:open", { bubbles: true }));
    },
  };

  const heading = (level: 1 | 2 | 3 | 4): InsertAction => ({
    id: `heading-${level}`,
    group: "basic",
    label: tr(`slash.heading${level}.label`),
    description: tr(`slash.heading${level}.description`),
    aliases: [`h${level}`, `biaoti${level}`],
    icon: `Heading${level}`,
    shortcut: "#".repeat(level),
    available: true,
    previewTitle: tr(`slash.heading${level}.previewTitle`),
    preview: pv.previewHeading(level, tr),
    run: () => {
      prepareInsert();
      editor.chain().focus().toggleHeading({ level }).run();
    },
  });

  return [
    ...(aiEnabled ? [aiAction] : []),
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
      preview: pv.previewParagraph(),
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
      preview: pv.previewBulletList(),
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
      preview: pv.previewOrderedList(),
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
      preview: pv.previewTaskList(),
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
      preview: pv.previewStatus(tr),
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
      preview: pv.previewBlockquote(),
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
      preview: pv.previewCodeBlock(),
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
      preview: pv.previewTable(),
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
      preview: pv.previewImage(),
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
      preview: pv.previewLink(tr),
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
      preview: pv.previewColumns(),
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
      preview: pv.previewDetails(),
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
      preview: pv.previewTOC(),
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
      preview: pv.previewCallout(tr),
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
      preview: pv.previewKatex(),
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
      preview: pv.previewIframe(),
      run: () => {
        prepareInsert();
        editor.chain().focus().setIframe({ url: null }).run();
      },
    },
    {
      id: "video",
      group: "media",
      label: tr("slash.video.label"),
      description: tr("slash.video.description"),
      aliases: ["shipin", "video", "movie"],
      icon: "Video",
      available: true,
      previewTitle: tr("slash.video.previewTitle"),
      preview: pv.previewVideo(),
      run: () => {
        prepareInsert();
        editor.chain().focus().setVideo({ src: null }).run();
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
      preview: pv.previewAttachment(),
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
      preview: pv.previewEmoji(),
      run: () => {
        prepareInsert();
        editor.chain().focus().insertContent(":").run();
      },
    },
    {
      id: "canvas",
      group: "structure",
      label: tr("slash.canvas.label"),
      description: tr("slash.canvas.description"),
      aliases: ["huaban", "canvas", "whiteboard", "draw"],
      icon: "Brush",
      available: true,
      previewTitle: tr("slash.canvas.previewTitle"),
      preview: pv.previewCanvas(),
      run: () => {
        prepareInsert();
        editor.chain().focus().setCanvas().run();
      },
    },
    {
      id: "footnote",
      group: "structure",
      label: tr("slash.footnote.label"),
      description: tr("slash.footnote.description"),
      aliases: ["footnote", "jiaozhu", "zhushi"],
      icon: "Superscript",
      available: true,
      previewTitle: tr("slash.footnote.previewTitle"),
      preview: pv.previewFootnote(),
      run: () => {
        prepareInsert();
        editor.chain().focus().setFootnote().run();
      },
    },
  ];
}
