import type { Editor } from "@tiptap/react";
import type { Translate } from "./i18n/messages";

/**
 * TipKit 共享类型。
 *
 * 契约原则：core 只描述"行为"（数据结构、命令、激活态），
 * 不描述"视觉"。消费方（项目/主题）根据这些结构渲染自己的 UI。
 */

/** 图标引用：core 不依赖图标库，约定 lucide-react 图标名，由消费方映射渲染 */
export type IconRef = string;

/** 工具栏动作：逻辑与激活态由 core 计算，视觉由主题渲染 */
export interface ToolbarAction {
  /** button | select（下拉） | menu（子菜单） | divider */
  type: "button" | "select" | "menu" | "divider";
  id: string;
  label: string;
  icon?: IconRef;
  /** 当前是否激活（如加粗生效中） */
  isActive?: () => boolean;
  /** 是否可用（如无选区时链接按钮禁用） */
  isEnabled?: () => boolean;
  onExecute?: (editor: Editor) => void;
  /** select/menu 类型：选项列表 */
  options?: ToolbarOption[];
}

export interface ToolbarOption {
  id: string;
  label: string;
  icon?: IconRef;
  isActive?: () => boolean;
  onSelect: (editor: Editor) => void;
}

/** 工具栏分组（沿用 blog rich-text 的 buildToolbarGroups 概念） */
export interface ToolbarGroup {
  id: string;
  actions: ToolbarAction[];
}

/** 目录大纲条目（用于 TOC 面板 / 文章目录渲染） */
export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

/**
 * 依赖注入契约：所有"项目特定"的能力都从这里注入，
 * core/extensions 内部不得直接调用上传、存储、渲染服务。
 */
export interface EditorDeps {
  /** 图片上传：返回可用于 <img src> 的 URL */
  uploadImage?: (file: File, editor: Editor) => Promise<string>;
  /** 附件上传：返回附件元数据 */
  uploadAttachment?: (file: File, editor: Editor) => Promise<AttachmentMeta>;
  /** Katex 渲染：返回渲染后的 HTML（服务端/客户端均可） */
  renderKatex?: (tex: string, displayMode: boolean) => Promise<string>;
  /** i18n 翻译函数。不传时默认中文（zh 词典） */
  t?: Translate;
  /** 评论创建回调：当选中文本创建评论时触发 */
  onCommentCreate?: (range: CommentRange) => void;
  /** 评论点击回调：当点击已有评论标记时触发 */
  onCommentClick?: (commentId: string) => void;
}

export interface AttachmentMeta {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

/** 图片节点属性（对齐/样式/宽度，沿用 blog image-block 设计） */
export interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  align?: "left" | "center" | "right";
  style?: string;
  width?: number | string;
}

/** 评论范围标记：表示文档中一段文本关联的评论 */
export interface CommentRange {
  from: number;
  to: number;
  text: string;
  commentId: string;
}
