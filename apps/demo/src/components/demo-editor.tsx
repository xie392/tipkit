"use client";

import type { Editor } from "@tiptap/react";
import { TipKitEditor } from "@tipkit/editor";
import type { EditorDeps, IconRef } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions } from "@tipkit/extensions";
import { SlashMenu, EmojiSuggestion, TextMenu, LinkBubble, LinkDialogHost, BlockBubbleMenu, BlockHandleMenu, TableControls } from "@tipkit/ui";
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
 * 视觉样式由页面加载的主题 CSS（tk-theme-default / tk-theme-sketch）决定，
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
  <li>输入 <code>:smile</code> 触发 Emoji 建议：😄 🎉 🚀 ✨</li>
</ul>
<blockquote><p>悬停块左侧出现 ⋮⋮ 手柄，可拖拽调整顺序；点 + 在块前插入。</p></blockquote>
<h2>任务列表</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>无头编辑器内核完成</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>主题皮肤就位</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>接入真实项目</p></div></li>
</ul>
<h2>代码块</h2>
<pre data-theme="light"><code class="language-typescript">import { TipKitEditor } from "@tipkit/editor";

export default function App() {
  // 同一套逻辑，多种皮肤，切换零成本
  return &lt;TipKitEditor className="tk-theme-sketch" /&gt;;
}</code></pre>
<h2>表格</h2>
<table><tbody><tr><th>能力</th><th>入口</th><th>说明</th></tr><tr><td>斜杠菜单</td><td><code>/</code></td><td>21 种内容节点</td></tr><tr><td>Markdown</td><td>直接粘贴</td><td>即时转换</td></tr><tr><td>Emoji</td><td><code>:smile</code></td><td>方向键浏览</td></tr></tbody></table>
<h2>图片</h2>
<p>粘贴或上传图片自动转为图片块：选中后可拖拽四角缩放、调整对齐方式与宽度。</p>
<div data-type="image-block" data-align="center" data-width="100%"><img src="data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='450'%20viewBox='0%200%20800%20450'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23f6f5f4'/%3E%3Cstop%20offset='1'%20stop-color='%23e4ded3'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='800'%20height='450'%20fill='url(%23g)'/%3E%3Crect%20x='40'%20y='40'%20width='720'%20height='370'%20rx='18'%20fill='none'%20stroke='%23cfc7ba'%20stroke-width='2'/%3E%3Ctext%20x='400'%20y='212'%20font-family='Georgia,serif'%20font-size='44'%20fill='%2331302e'%20text-anchor='middle'%3ETipKit%20图片块%3C/text%3E%3Ctext%20x='400'%20y='256'%20font-family='sans-serif'%20font-size='17'%20fill='%238a857c'%20text-anchor='middle'%3E选中图片可拖拽四角缩放，也可调对齐与宽度%3C/text%3E%3C/svg%3E" alt="TipKit 图片块示例"></div>
<hr>
<h2>高级节点</h2>
<p>下面是各高级节点的渲染示例，可配合左侧 ⋮⋮ 手柄拖拽排序、点击块选中后浮动工具条操作。</p>
<h3>提示框 Callout</h3>
<div class="tk-callout" data-variant="info" data-emoji="💡"><div class="tk-callout-content"><p>这是一条<strong>信息提示</strong>：斜杠菜单输入 <code>/callout</code> 即可插入，支持切换 info / success / warning / danger 四种样式与自定义 emoji。</p></div></div>
<div class="tk-callout" data-variant="success" data-emoji="✅"><div class="tk-callout-content"><p>成功提示：操作已完成。</p></div></div>
<div class="tk-callout" data-variant="warning" data-emoji="⚠️"><div class="tk-callout-content"><p>警告提示：请注意边界情况。</p></div></div>
<div class="tk-callout" data-variant="danger" data-emoji="🛑"><div class="tk-callout-content"><p>危险提示：此操作不可撤销。</p></div></div>
<h3>数学公式 KaTeX</h3>
<div class="tk-katex" data-text="E = mc^2"></div>
<p>质能方程描述了质量与能量的关系；下面是求根公式：</p>
<div class="tk-katex" data-text="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"></div>
<h3>分栏 Columns</h3>
<div data-type="columns" class="tk-columns layout-two-column"><div data-type="column" class="tk-column" data-position="left"><p><strong>左栏</strong></p><p>这里是第一列的内容，可以放任意块级元素：列表、代码块、图片等。</p><ul><li>分栏一</li><li>分栏二</li></ul></div><div data-type="column" class="tk-column" data-position="right"><p><strong>右栏</strong></p><p>这里是第二列。斜杠菜单可切换两栏 / 左窄右宽 / 左宽右窄布局。</p><blockquote><p>栏内引用块示例。</p></blockquote></div></div>
<h3>折叠块 Details</h3>
<details data-type="details" class="tk-details" open="open"><summary data-type="summary" class="tk-details-summary">点击展开 / 收起：常见问题</summary><div data-type="details-content" class="tk-details-content"><p>折叠块默认展开，点击标题栏可收起。内部可以放任意块级内容。</p><ol><li>第一步内容</li><li>第二步内容</li><li>第三步内容</li></ol></div></details>
<details data-type="details" class="tk-details"><summary data-type="summary" class="tk-details-summary">这是一个默认收起的折叠块</summary><div data-type="details-content" class="tk-details-content"><p>你展开我了 👋</p></div></details>
<h3>页面目录 TOC</h3>
<div data-type="table-of-content"></div>
<h3>嵌入 Iframe</h3>
<div class="tk-iframe" data-url="https://example.com" data-width="100%" data-height="320"></div>
<h3>附件 Attachment</h3>
<div class="tk-attachment" data-filename="项目设计文档.pdf" data-filesize="2048576" data-filetype="application/pdf" data-fileext="pdf" data-url="#"></div>
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
            <LinkDialogHost editor={editor} />
            <BlockBubbleMenu editor={editor} />
            <BlockHandleMenu editor={editor} />
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
