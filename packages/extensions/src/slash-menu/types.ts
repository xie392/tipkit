import type { IconRef, Translate } from "@tipkit/core";

/* 斜杠菜单类型与分组定义。 */

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

export interface GetInsertActionsOptions {
  editor: import("@tiptap/react").Editor;
  /** 有值时"图片"走本地文件选择 */
  openImagePicker?: () => void;
  /** 有值时"链接"走自定义弹窗（否则退化 window.prompt） */
  openLinkDialog?: () => void;
  /** 执行动作前删除 "/关键词" 文本（slash 菜单用） */
  clearSlashQuery?: boolean;
  /** i18n 翻译函数 */
  t?: Translate;
  /** 是否展示 AI 助手入口（消费方需已注册 AiGeneration + AiMenu） */
  aiEnabled?: boolean;
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
