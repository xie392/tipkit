"use client";

import type { Editor } from "@tiptap/react";
import { TipKitEditor } from "@tipkit/editor";
import type { EditorDeps, IconRef } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import { SlashMenu, EmojiSuggestion, TextMenu, LinkBubble, BlockBubbleMenu, TableControls } from "@tipkit/ui";
import { TooltipProvider } from "@tipkit/components";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Code,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Table2,
  Link,
  Undo2,
  Redo2,
  Image,
  Text,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Columns2,
  ChevronDownSquare,
  ListTree,
  TriangleAlert,
  Sigma,
  Frame,
  Paperclip,
  Smile,
  type LucideIcon,
} from "lucide-react";

/**
 * 演示编辑器：TipKitEditor + 数据驱动主题工具栏。
 *
 * 工具栏渲染由页面级 EditorToolbar（editor-toolbar.tsx）完成，
 * 它挂在页面 header 下方 sticky 工具条内；编辑器实例通过
 * onEditorReady 回传给页面。
 * 视觉样式由页面加载的主题 CSS（tk-theme-devkb / tk-theme-blog）决定，
 * 组件本身只携带语义类名（tk-toolbar / tk-toolbar-btn）。
 */

const iconMap: Record<IconRef, LucideIcon> = {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Text,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Table2,
  Image,
  Link,
  Columns2,
  ChevronDownSquare,
  ListTree,
  TriangleAlert,
  Sigma,
  Frame,
  Paperclip,
  Smile,
};

/** demo 图片上传：本地 blob 预览（消费方替换为真实上传） */
const uploadImage = async (file: File): Promise<string> => URL.createObjectURL(file);

const demoDeps: EditorDeps = {
  uploadImage,
};

/** 示例内容：展示常见格式（HTML 由 ProseMirror 解析） */
const DEMO_CONTENT = `
<h1>TipKit 编辑器演示</h1>
<p>这是一段 <strong>加粗</strong>、<em>斜体</em>、<s>删除线</s> 和 <code>行内代码</code> 的正文，试试 <mark>高亮</mark> 与 <u>下划线</u>，以及一个 <a href="https://tiptap.dev">外部链接</a>。</p>
<h2>功能一览</h2>
<ul>
  <li>输入 <code>/</code> 打开斜杠菜单，插入 21 种内容</li>
  <li>直接粘贴 Markdown，或输入 <code>##</code>、<code>- </code>、<code>1. </code> 即时转换</li>
  <li>输入 <code>:smile</code> 触发 Emoji 建议</li>
</ul>
<blockquote><p>悬停块左侧出现 ⋮⋮ 手柄，可拖拽调整顺序；点 + 在块前插入。</p></blockquote>
<h2>任务列表</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>无头编辑器内核完成</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>三套主题皮肤就位</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>接入真实项目</p></div></li>
</ul>
<h2>代码块</h2>
<pre data-theme="light"><code class="language-typescript">import { TipKitEditor } from "@tipkit/editor";

export default function App() {
  // 同一套逻辑，三种皮肤，切换零成本
  return &lt;TipKitEditor className="tk-theme-blog" /&gt;;
}</code></pre>
<h2>表格</h2>
<table><tbody><tr><th>能力</th><th>入口</th><th>说明</th></tr><tr><td>斜杠菜单</td><td><code>/</code></td><td>21 种内容节点</td></tr><tr><td>Markdown</td><td>直接粘贴</td><td>即时转换</td></tr><tr><td>Emoji</td><td><code>:smile</code></td><td>方向键浏览</td></tr></tbody></table>
<h2>高级节点</h2>
<p>斜杠菜单可插入：数学公式、提示框、分栏、折叠块、页面目录、iframe 嵌入、附件等。</p>
`;

export function DemoEditor({
  placeholder,
  onEditorReady,
}: {
  placeholder?: string;
  /** 编辑器实例就绪后回传（供页面级工具栏使用） */
  onEditorReady?: (editor: Editor) => void;
}) {
  return (
    <TipKitEditor
      deps={demoDeps}
      content={DEMO_CONTENT}
      onCreate={(editor) => onEditorReady?.(editor)}
      extensions={[
        ...createBasicExtensions(),
        ...createAdvancedExtensions(),
      ]}
      placeholder={placeholder}
      className="max-w-4xl mx-auto"
      onChange={(editor) => {
        // demo：输出 HTML 便于观察序列化结果
        console.log("[tipkit] html:", editor.getHTML().slice(0, 200));
      }}
    >
      {(editor) =>
        editor ? (
          <TooltipProvider delayDuration={300}>
            <SlashMenu editor={editor} onUploadImage={uploadImage} iconRenderer={renderSlashIcon} />
            <EmojiSuggestion editor={editor} />
            <TextMenu editor={editor} />
            <LinkBubble editor={editor} />
            <BlockBubbleMenu editor={editor} />
            <TableControls editor={editor} />
          </TooltipProvider>
        ) : null
      }
    </TipKitEditor>
  );
}

/** 斜杠菜单图标映射：lucide 图标名 → 组件 */
function renderSlashIcon(icon: string) {
  const Icon = iconMap[icon as IconRef];
  return Icon ? <Icon className="w-4 h-4" /> : null;
}
