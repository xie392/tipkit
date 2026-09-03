"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { TipKitEditor } from "@tipkit/editor";
import type { EditorDeps, IconRef, CommentRange, AIProvider } from "@tipkit/editor";
import { createBasicExtensions, createAdvancedExtensions, createFootnoteExtensions, Comment, Canvas, AiGeneration, Emoji, SearchAndReplace } from "@tipkit/extensions";
import { SlashMenu, EmojiSuggestion, TextMenu, LinkBubble, LinkDialogHost, BlockHandleMenu, TableControls, ReadonlyTextMenu, AiMenu } from "@tipkit/ui";
import { useDemoLang } from "@/components/use-demo-lang";
import type { DemoLang } from "@/components/site-lang-switch";
import { BlockCommentHover } from "@/components/block-comment-hover";
import { CommentHoverCard } from "@/components/comment-hover-card";
import { CommentAnchorGutter } from "@/components/comment-anchor-gutter";
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
  Video,
  Badge,
  MessageSquare,
  Send,
  X,
  Sparkles,
  Pencil,
  Reply,
  Check,
  Brush,
  Superscript,
  type LucideIcon,
} from "lucide-react";

/**
 * 演示编辑器：TipKitEditor + 划词评论（飞书/语雀式右侧 sticky 面板）。
 * - 面板紧贴文章白纸右侧，随页面滚动 sticky 定位，顶部对齐白纸
 * - 编辑态/只读态都支持划词评论（TextMenu 在只读态仅显示评论按钮）
 */

const iconMap: Record<IconRef, LucideIcon> = {
  Video,
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
  Badge,
  Brush,
  Sparkles,
  Superscript,
};

/** demo 图片上传：本地 blob 预览 */
const uploadImage = async (file: File): Promise<string> => URL.createObjectURL(file);

/** demo 附件/视频上传：模拟 600ms 网络延迟后返回本地 blob URL（无需真实服务端） */
const uploadAttachment = async (file: File) => {
  await new Promise((r) => setTimeout(r, 600));
  return { url: URL.createObjectURL(file), name: file.name, size: file.size, mimeType: file.type };
};

/** DeepSeek AI provider：通过 Next.js /api/ai 代理（解决 CORS，key 只存服务端） */
const deepseekAI: AIProvider = {
  async *streamText({ prompt, selection, signal }) {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, selection }),
      signal,
    });

    if (!res.ok) {
      let msg = `AI 请求失败 (${res.status})`;
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("响应体不可读");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line || !line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // ignore malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

/** AI provider：通过 Next.js /api/ai 代理调用 DeepSeek（解决 CORS，key 只存服务端） */
const aiProvider: AIProvider = deepseekAI;

const PLACEHOLDER: Record<DemoLang, string> = {
  zh: "输入 / 打开斜杠菜单，或直接粘贴 Markdown…",
  en: "Type / to open the slash menu, or paste Markdown…",
};

interface DemoReply {
  id: string;
  text: string;
  createdAt: number;
  author: string;
  /** 若该回复是回复另一条回复，则记录被回复的 replyId；直接回复主评论为 null */
  parentReplyId: string | null;
  /** 被回复人的名字（缓存展示用，避免查找） */
  parentAuthor: string | null;
}
interface DemoComment {
  id: string;
  text: string;
  quote: string;
  createdAt: number;
  author: string;
  replies?: DemoReply[];
}

/** 默认示例评论 id（与 DEMO_CONTENT 中 data-comment-id 对应） */
const DEMO_COMMENT_ID = "c_demo_001";
const DEMO_AUTHOR = "TipKit";
const CURRENT_USER = "我";

const DEMO_CONTENT = `
<h1>TipKit 编辑器演示</h1>
<p>这是一段 <strong>加粗</strong>、<em>斜体</em>、<s>删除线</s> 和 <code>行内代码</code> 的正文，试试 <mark>高亮</mark> 与 <u>下划线</u>，以及一个 <a href="https://tiptap.dev">外部链接</a>。</p>
<p>还有上下标：H<sub>2</sub>O、E = mc<sup>2</sup>；<span style="color: #e11d48">彩色文字</span>、<span style="color: #2563eb">蓝色文字</span>、<span style="font-size: 20px">20px 大号文字</span>、<span style="font-family: Georgia, serif">Georgia 字体</span>。</p>
<h2>目录 TOC</h2>
<div data-type="table-of-content"></div>
<p>👉 <span class="tk-comment" data-comment-id="${DEMO_COMMENT_ID}">选中任意一段文字，在弹出的气泡菜单中点击最右侧 💬 图标即可添加划词评论；写好的评论会保存在右侧悬浮面板里。</span>点击已高亮的文字可在面板中定位对应评论。</p>
<h2>功能一览</h2>
<ul>
  <li>输入 <code>/</code> 打开斜杠菜单，插入 20 余种内容</li>
  <li>直接粘贴 Markdown，或输入 <code>##</code>、<code>- </code>、<code>1. </code> 即时转换</li>
  <li>输入 <code>:smile</code> 触发 Emoji 建议：😄 🎉 🚀 ✨</li>
  <li>拖拽文件/图片到编辑器即可插入附件或图片块</li>
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
  return &lt;TipKitEditor className="tk-theme-sketch" /&gt;;
}</code></pre>
<h2>表格</h2>
<table><tbody><tr><th>能力</th><th>入口</th><th>说明</th></tr><tr><td>斜杠菜单</td><td><code>/</code></td><td>27 种内容节点</td></tr><tr><td>Markdown</td><td>直接粘贴</td><td>即时转换</td></tr><tr><td>Emoji</td><td><code>:smile</code></td><td>方向键浏览</td></tr></tbody></table>
<h2>Mermaid 图表</h2>
<p>代码块语言切换到 <code>mermaid</code> 即可渲染图表：默认只显示图，<strong>双击图表</strong>或点右上角 <code>&lt;/&gt;</code> 按钮进入代码编辑（此时隐藏图表），改完点 👁 按钮回到图表视图。</p>
<pre><code class="language-mermaid">flowchart LR
  A[输入 Markdown] --> B{是代码块?}
  B -- 是 --> C[高亮渲染]
  B -- 否 --> D[普通文本]
  C --> E[Mermaid 预览]</code></pre>
<h2>图片</h2>
<p>粘贴或上传图片自动转为图片块：选中后可拖拽四角缩放、调整对齐方式与宽度。</p>
<div data-type="image-block" data-align="center" data-width="100%"><img src="data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='450'%20viewBox='0%200%20800%20450'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23f6f5f4'/%3E%3Cstop%20offset='1'%20stop-color='%23e4ded3'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='800'%20height='450'%20fill='url(%23g)'/%3E%3Crect%20x='40'%20y='40'%20width='720'%20height='370'%20rx='18'%20fill='none'%20stroke='%23cfc7ba'%20stroke-width='2'/%3E%3Ctext%20x='400'%20y='212'%20font-family='Georgia,serif'%20font-size='44'%20fill='%2331302e'%20text-anchor='middle'%3ETipKit%20图片块%3C/text%3E%3Ctext%20x='400'%20y='256'%20font-family='sans-serif'%20font-size='17'%20fill='%238a857c'%20text-anchor='middle'%3E选中图片可拖拽四角缩放，也可调对齐与宽度%3C/text%3E%3C/svg%3E" alt="TipKit 图片块示例"></div>
<hr>
<h2>高级节点</h2>
<p>下面是各高级节点的渲染示例，可配合左侧 ⋮⋮ 手柄拖拽排序、点击块选中后浮动工具条操作。</p>
<h3>提示框 Callout</h3>
<div class="tk-callout" data-variant="info" data-emoji="💡"><div class="tk-callout-content"><p>这是一条<strong>信息提示</strong>：斜杠菜单输入 <code>/callout</code> 即可插入。</p></div></div>
<h3>数学公式 KaTeX</h3>
<div class="tk-katex" data-text="E = mc^2"></div>
<h3>分栏 Columns</h3>
<div data-type="columns" class="tk-columns layout-two-column"><div data-type="column" class="tk-column" data-position="left"><p><strong>左栏</strong></p><p>这里是第一列的内容。</p></div><div data-type="column" class="tk-column" data-position="right"><p><strong>右栏</strong></p><blockquote><p>栏内引用块示例。</p></blockquote></div></div>
<h3>折叠块 Details</h3>
<details data-type="details" class="tk-details" open="open"><summary data-type="summary" class="tk-details-summary">点击展开 / 收起：常见问题</summary><div data-type="details-content" class="tk-details-content"><ol><li>第一步内容</li><li>第二步内容</li></ol></div></details>
<h3>状态标签 Status</h3>
<p>行内状态标签：任务当前 <span class="tk-status" data-status="true" data-text="进行中" data-color="#bfdbfe">进行中</span>，完成变为 <span class="tk-status" data-status="true" data-text="已完成" data-color="#bbf7d0">已完成</span>，也可以是 <span class="tk-status" data-status="true" data-text="已阻塞" data-color="#fecaca">已阻塞</span>。点击可弹出取色与改名的浮层。</p>
<h3>Emoji 节点</h3>
<p>斜杠菜单或 <code>:shortname</code> 插入的 Emoji 是独立节点：<span class="tk-emoji" data-name="rocket">🚀</span> <span class="tk-emoji" data-name="tada">🎉</span> <span class="tk-emoji" data-name="fire">🔥</span> <span class="tk-emoji" data-name="sparkles">✨</span>，复制粘贴/序列化不会丢。</p>
<h3>嵌入 Iframe</h3>
<div class="tk-iframe" data-url="https://www.youtube.com/embed/aqz-KE-bpKQ" data-width="100%" data-height="360"></div>
<h3>视频 Video</h3>
<div data-type="video" data-src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"></div>
<h3>附件 Attachment</h3>
<p>第一条带下载链接；第二条是空附件，点击卡片即可选择文件 —— demo 用本地 blob URL 模拟上传（含 600ms 假延迟），无需真实服务端。</p>
<div class="tk-attachment" data-filename="TipKit-产品需求文档.pdf" data-fileext="pdf" data-filetype="application/pdf" data-filesize="2048000" data-url="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"></div>
<div class="tk-attachment"></div>
<h3>脚注 Footnotes</h3>
<p>斜杠菜单或 <code>/footnote</code> 插入脚注：TipKit 是无头编辑器套件<sup class="tk-footnote-ref" data-id="fn-demo-1"></sup>，风格由消费方项目决定<sup class="tk-footnote-ref" data-id="fn-demo-2"></sup>。</p>
<h3>画板 Canvas</h3>
<p>下方是一块可交互画板：点击进入编辑，可切换画笔/图形工具，支持手绘(sketch)风格与网格吸附，内容随文档一起序列化。</p>
<div data-type="canvas" data-width="800" data-height="520" data-style="sketch" data-snap="true" data-shapes="[]"></div>
<div class="tk-footnotes"><div class="tk-footnote-item" data-id="fn-demo-1"><p>TipKit：基于 Tiptap v3 + shadcn/ui 的无头富文本编辑器套件，供 blog / devkb 等多个项目共用。</p></div><div class="tk-footnote-item" data-id="fn-demo-2"><p>主题系统：一切视觉样式集中在 @tipkit/themes 皮肤层，编辑器内核零样式。</p></div></div>
`;

export function DemoEditor({
  placeholder,
  editable = true,
  onEditorReady,
}: {
  placeholder?: string;
  editable?: boolean;
  onEditorReady?: (editor: Editor) => void;
}) {
  const { lang, t } = useDemoLang();
  const editorRef = useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  const [comments, setComments] = useState<DemoComment[]>(() => [
    {
      id: DEMO_COMMENT_ID,
      text:
        lang === "zh"
          ? "👋 这是一条预置的示例评论，演示飞书/语雀式的划词评论效果。选中任意文字后点击气泡中的 💬 即可添加新评论，支持编辑态和只读态。"
          : "👋 This is a demo inline comment. Select any text and tap 💬 in the bubble menu to add more — works in both edit and read-only mode.",
      quote:
        lang === "zh"
          ? "选中任意一段文字，在弹出的气泡菜单中点击最右侧 💬 图标即可添加划词评论…"
          : "Select any text and tap 💬 in the bubble menu to add a comment…",
      createdAt: Date.now(),
      author: DEMO_AUTHOR,
    },
  ]);
  const [pendingRange, setPendingRange] = useState<CommentRange | null>(null);
  const pendingRangeRef = useRef<CommentRange | null>(null);
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyDraft, setEditReplyDraft] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  /** 正在回复的目标：null = 回复主评论；{replyId, author} = 回复某条回复 */
  const [replyTarget, setReplyTarget] = useState<{ replyId: string; author: string } | null>(null);

  /** 已存在的评论 id 集合（供锚点组件做 O(1) 存在性判断） */
  const existingCommentIds = useMemo(() => new Set(comments.map((c) => c.id)), [comments]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    pendingRangeRef.current = pendingRange;
  }, [pendingRange]);

  /** 只读模式下划词评论回调：ReadonlyTextMenu 已经通过 view.dispatch 把 mark 加上了，这里只负责设置 pending 状态并打开抽屉 */
  const handleReadonlyCommentCreate = useCallback((range: { from: number; to: number; text: string; commentId: string }) => {
    setPendingRange(range);
    setDraft("");
    setActiveId(range.commentId);
    setDrawerOpen(true);
  }, []);

  const deps = useMemo<EditorDeps>(
    () => ({
      uploadImage,
      uploadAttachment,
      ai: aiProvider,
      t,
      onCommentCreate: (range) => {
        setPendingRange(range);
        setDraft("");
        // 创建新评论时仍直接打开抽屉，方便输入内容
        setDrawerOpen(true);
      },
      // onCommentClick 不再由点击评论文字自动触发（扩展层已取消自动拦截，避免点击弹遮罩阻断编辑）；
      // 改为由 hover 卡片 / FAB / 面板项点击主动调用 openCommentPanel
    }),
    [t],
  );

  /** 打开右侧评论面板并定位到指定评论（供 hover 卡片/FAB/面板项调用） */
  const openCommentPanel = useCallback((commentId: string | null) => {
    setActiveId(commentId);
    setDrawerOpen(true);
    if (!commentId) return;
    // 1) 面板内评论项滚动到可视区并闪烁
    setTimeout(() => {
      const el = document.getElementById(`comment-${commentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("is-flash");
      setTimeout(() => el?.classList.remove("is-flash"), 1400);
    }, 120);
    // 2) 正文锚点滚动到可视区并闪烁
    setTimeout(() => {
      const editor = editorRef.current;
      const view = editor?.view;
      if (!view) return;
      const anchor = view.dom.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`);
      if (!anchor) return;
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
      anchor.classList.add("is-comment-flash");
      setTimeout(() => anchor.classList.remove("is-comment-flash"), 1400);
    }, 120);
  }, []);

  const commentExt = useMemo(() => Comment.configure(), []);

  const submitComment = () => {
    if (!pendingRange || !draft.trim()) return;
    setComments((list) => [
      ...list,
      {
        id: pendingRange.commentId,
        text: draft.trim(),
        quote: pendingRange.text,
        createdAt: Date.now(),
        author: CURRENT_USER,
      },
    ]);
    setPendingRange(null);
    setDraft("");
  };

  /** 对整段（块）添加评论：只读模式下通过 view.dispatch 直接 addMark（绕过命令层 editable 检查），并直接打开评论输入框 */
  const handleBlockComment = (from: number, to: number, text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const commentId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const tr = editor.state.tr;
    const markType = editor.schema.marks.comment;
    if (markType) {
      tr.addMark(from, to, markType.create({ commentId }));
      editor.view.dispatch(tr);
    }
    setPendingRange({ from, to, commentId, text });
    setDraft("");
    setDrawerOpen(true);
  };

  const cancelComment = () => {
    if (pendingRange && editorRef.current) {
      (editorRef.current.commands as unknown as { removeComment: (id: string) => boolean }).removeComment(pendingRange.commentId);
    }
    setPendingRange(null);
    setDraft("");
  };

  /** 关闭抽屉：若当前有未提交的 pending 评论（用户直接点遮罩/X），取消并移除 mark */
  const closeDrawer = () => {
    setDrawerOpen(false);
    if (pendingRange) {
      cancelComment();
    }
  };

  const removeComment = (id: string) => {
    if (editorRef.current) {
      (editorRef.current.commands as unknown as { removeComment: (id: string) => boolean }).removeComment(id);
    }
    setComments((list) => list.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    if (editingId === id) setEditingId(null);
    if (replyingId === id) setReplyingId(null);
  };

  const startEdit = (c: DemoComment) => {
    setEditingId(c.id);
    setEditDraft(c.text);
    setReplyingId(null);
  };
  const saveEdit = (id: string) => {
    const text = editDraft.trim();
    if (!text) return;
    setComments((list) => list.map((c) => (c.id === id ? { ...c, text } : c)));
    setEditingId(null);
    setEditDraft("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const startReply = (id: string) => {
    setReplyingId(id);
    setReplyDraft("");
    setReplyTarget(null);
    setEditingId(null);
    setEditingReplyId(null);
  };
  const submitReply = (id: string) => {
    const text = replyDraft.trim();
    if (!text) return;
    const newReply: DemoReply = {
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      text,
      createdAt: Date.now(),
      author: CURRENT_USER,
      parentReplyId: replyTarget?.replyId ?? null,
      parentAuthor: replyTarget?.author ?? null,
    };
    setComments((list) =>
      list.map((c) => (c.id === id ? { ...c, replies: [...(c.replies ?? []), newReply] } : c)),
    );
    setReplyingId(null);
    setReplyDraft("");
    setReplyTarget(null);
  };
  const cancelReply = () => {
    setReplyingId(null);
    setReplyDraft("");
    setReplyTarget(null);
  };
  const removeReply = (commentId: string, replyId: string) => {
    setComments((list) =>
      list.map((c) =>
        c.id === commentId ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== replyId) } : c,
      ),
    );
    if (editingReplyId === replyId) setEditingReplyId(null);
  };

  const startEditReply = (replyId: string, text: string) => {
    setEditingReplyId(replyId);
    setEditReplyDraft(text);
  };
  const saveEditReply = (commentId: string, replyId: string) => {
    const text = editReplyDraft.trim();
    if (!text) return;
    setComments((list) =>
      list.map((c) =>
        c.id === commentId
          ? { ...c, replies: (c.replies ?? []).map((r) => (r.id === replyId ? { ...r, text } : r)) }
          : c,
      ),
    );
    setEditingReplyId(null);
    setEditReplyDraft("");
  };
  const cancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyDraft("");
  };

  /** 回复某条回复 = 扁平追加到主评论（飞书式，不做二级嵌套） */
  const startReplyToReply = (commentId: string, parentReplyId: string, parentAuthor: string) => {
    setReplyingId(commentId);
    setReplyDraft("");
    setReplyTarget({ replyId: parentReplyId, author: parentAuthor });
    setEditingId(null);
    setEditingReplyId(null);
  };

  const commentPanel = (
    <aside
      className={`demo-comment-drawer${drawerOpen ? " is-open" : ""}`}
      aria-hidden={!drawerOpen}
    >
      <div className="demo-comment-panel">
        <div className="demo-comment-panel-header">
          <MessageSquare className="w-4 h-4" />
          <span>{lang === "zh" ? "划词评论" : "Comments"}</span>
          <span className="demo-comment-count">{comments.length}</span>
          <button
            type="button"
            className="demo-comment-close"
            onClick={() => closeDrawer()}
            aria-label={lang === "zh" ? "关闭" : "Close"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {comments.length === 0 && !pendingRange && (
          <div className="demo-comment-empty">
            {lang === "zh"
              ? "选中一段文字，点击气泡菜单里的 💬 按钮开始评论（只读模式也可用）"
              : "Select text and tap 💬 in the bubble menu — works in read-only too"}
          </div>
        )}

        <div className="demo-comment-list">
          {comments.map((c) => (
            <div
              key={c.id}
              id={`comment-${c.id}`}
              className={`demo-comment-item${activeId === c.id ? " is-active" : ""}`}
              onClick={() => {
                // 点击面板内评论项 → 高亮正文锚点（已在 openCommentPanel 中处理）
                const editor = editorRef.current;
                const view = editor?.view;
                const anchor = view?.dom.querySelector<HTMLElement>(`[data-comment-id="${c.id}"]`);
                if (anchor) {
                  anchor.scrollIntoView({ behavior: "smooth", block: "center" });
                  anchor.classList.add("is-comment-flash");
                  setTimeout(() => anchor.classList.remove("is-comment-flash"), 1400);
                }
              }}
            >
              <div className="demo-comment-quote">"{c.quote}"</div>

              {editingId === c.id ? (
                <div className="demo-comment-edit" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    className="demo-comment-input"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(c.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <div className="demo-comment-actions">
                    <button type="button" className="demo-comment-btn ghost" onClick={cancelEdit}>
                      {lang === "zh" ? "取消" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="demo-comment-btn primary"
                      onClick={() => saveEdit(c.id)}
                      disabled={!editDraft.trim()}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {lang === "zh" ? "保存" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="demo-comment-meta">
                    <span className="demo-comment-avatar">{c.author.slice(0, 1)}</span>
                    <span className="demo-comment-author">{c.author}</span>
                  </div>
                  <div className="demo-comment-text">{c.text}</div>
                  <div className="demo-comment-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="demo-comment-icon-btn"
                      title={lang === "zh" ? "回复" : "Reply"}
                      onClick={() => startReply(c.id)}
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="demo-comment-icon-btn"
                      title={lang === "zh" ? "编辑" : "Edit"}
                      onClick={() => startEdit(c)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="demo-comment-icon-btn danger"
                      title={lang === "zh" ? "删除" : "Delete"}
                      onClick={() => removeComment(c.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}

              {/* 回复列表 */}
              {c.replies && c.replies.length > 0 && (
                <div className="demo-comment-replies" onClick={(e) => e.stopPropagation()}>
                  {c.replies.map((r) => (
                    <div key={r.id} className="demo-comment-reply">
                      {editingReplyId === r.id ? (
                        <div className="demo-comment-edit" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            autoFocus
                            className="demo-comment-input"
                            value={editReplyDraft}
                            onChange={(e) => setEditReplyDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEditReply(c.id, r.id);
                              if (e.key === "Escape") cancelEditReply();
                            }}
                          />
                          <div className="demo-comment-actions">
                            <button type="button" className="demo-comment-btn ghost" onClick={cancelEditReply}>
                              {lang === "zh" ? "取消" : "Cancel"}
                            </button>
                            <button
                              type="button"
                              className="demo-comment-btn primary"
                              onClick={() => saveEditReply(c.id, r.id)}
                              disabled={!editReplyDraft.trim()}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {lang === "zh" ? "保存" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="demo-comment-reply-body">
                            <div className="demo-comment-reply-meta">
                              <span className="demo-comment-avatar sm">{r.author.slice(0, 1)}</span>
                              <span className="demo-comment-author sm">{r.author}</span>
                              {r.parentAuthor && (
                                <span className="demo-comment-reply-to">
                                  {lang === "zh" ? "回复" : "reply to"}{" "}
                                  <span className="demo-comment-mention">@{r.parentAuthor}</span>
                                </span>
                              )}
                            </div>
                            <div className="demo-comment-reply-text">{r.text}</div>
                          </div>
                          <div className="demo-comment-reply-actions">
                            <button
                              type="button"
                              className="demo-comment-icon-btn"
                              title={lang === "zh" ? "回复" : "Reply"}
                              onClick={() => startReplyToReply(c.id, r.id, r.author)}
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="demo-comment-icon-btn"
                              title={lang === "zh" ? "编辑" : "Edit"}
                              onClick={() => startEditReply(r.id, r.text)}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="demo-comment-icon-btn danger"
                              title={lang === "zh" ? "删除" : "Delete"}
                              onClick={() => removeReply(c.id, r.id)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 回复输入框 */}
              {replyingId === c.id && (
                <div className="demo-comment-reply-form" onClick={(e) => e.stopPropagation()}>
                  {replyTarget && (
                    <div className="demo-comment-reply-target">
                      {lang === "zh" ? "回复" : "Replying to"}{" "}
                      <span className="demo-comment-mention">@{replyTarget.author}</span>
                    </div>
                  )}
                  <textarea
                    autoFocus
                    className="demo-comment-input"
                    placeholder={
                      replyTarget
                        ? lang === "zh"
                          ? `回复 @${replyTarget.author}…`
                          : `Reply to @${replyTarget.author}…`
                        : lang === "zh"
                          ? "写下回复…"
                          : "Write a reply…"
                    }
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReply(c.id);
                      if (e.key === "Escape") cancelReply();
                    }}
                  />
                  <div className="demo-comment-actions">
                    <button type="button" className="demo-comment-btn ghost" onClick={cancelReply}>
                      {lang === "zh" ? "取消" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="demo-comment-btn primary"
                      onClick={() => submitReply(c.id)}
                      disabled={!replyDraft.trim()}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {lang === "zh" ? "回复" : "Reply"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {pendingRange && (
          <div className="demo-comment-composer">
            <div className="demo-comment-quote">"{pendingRange.text}"</div>
            <textarea
              autoFocus
              className="demo-comment-input"
              placeholder={lang === "zh" ? "写下你的评论…" : "Write a comment…"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                if (e.key === "Escape") cancelComment();
              }}
            />
            <div className="demo-comment-actions">
              <button type="button" className="demo-comment-btn ghost" onClick={cancelComment}>
                {lang === "zh" ? "取消" : "Cancel"}
              </button>
              <button type="button" className="demo-comment-btn primary" onClick={submitComment} disabled={!draft.trim()}>
                <Send className="w-3.5 h-3.5" />
                {lang === "zh" ? "发表" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="demo-editor-layout">
      <div className="demo-editor-article">
        <TipKitEditor
          deps={deps}
          content={DEMO_CONTENT}
          editable={editable}
          onCreate={(editor) => {
            editorRef.current = editor;
            setEditorInstance(editor);
            onEditorReady?.(editor);
          }}
          extensions={[
            ...createBasicExtensions(),
            SearchAndReplace,
            commentExt,
            Canvas,
            Emoji,
            AiGeneration,
            ...createFootnoteExtensions(),
            ...createAdvancedExtensions({ tocScrollOffset: 120 }),
          ]}
          placeholder={placeholder ?? PLACEHOLDER[lang]}
        >
          {(editor) => {
            if (editor) editorRef.current = editor;
            return editor ? (
              <TooltipProvider delayDuration={300}>
                <SlashMenu editor={editor} onUploadImage={uploadImage} iconRenderer={renderSlashIcon} aiEnabled={editable} />
                <EmojiSuggestion editor={editor} />
                <TextMenu editor={editor} />
                <ReadonlyTextMenu editor={editor} onCommentCreate={handleReadonlyCommentCreate} />
                <LinkBubble editor={editor} />
                <LinkDialogHost editor={editor} />
                {editable && <BlockHandleMenu editor={editor} />}
                <TableControls editor={editor} />
                {editable && <AiMenu editor={editor} />}
              </TooltipProvider>
            ) : null;
          }}
        </TipKitEditor>
      </div>

      {/* 中间 gutter：仅作空白占位 */}
      <div className="demo-editor-gutter" />

      {/* 只读模式 hover 块时显示的评论按钮（组件内部已用 Portal 挂到 body） */}
      <BlockCommentHover
        editor={editorInstance}
        enabled={!editable}
        onBlockComment={handleBlockComment}
      />

      {/* hover 评论文字时浮出的小评论卡片（语雀风格，不阻断编辑） */}
      <CommentHoverCard
        editor={editorInstance}
        getComment={(id) => {
          const c = comments.find((x) => x.id === id);
          if (!c) return null;
          return {
            author: c.author,
            text: c.text,
            createdAt: c.createdAt,
            replyCount: c.replies?.length ?? 0,
          };
        }}
        onOpenPanel={(id) => openCommentPanel(id)}
        text={{ view: lang === "zh" ? "查看评论" : "Open", reply: lang === "zh" ? "回复" : "Reply" }}
      />

      {/* 语雀风格：评论所在行右外侧 gutter 里显示小评论锚点图标 */}
      <CommentAnchorGutter
        editor={editorInstance}
        existingIds={existingCommentIds}
        onAnchorClick={(id) => openCommentPanel(id)}
      />

      {/* 评论抽屉 + FAB + 遮罩：Portal 到 body，避免 fixed 被祖先 transform 影响 */}
      {mounted && createPortal(
        <>
          {/* 悬浮 FAB：抽屉未打开时显示 */}
          {!drawerOpen && (
            <button
              type="button"
              className="demo-comment-fab"
              onClick={() => openCommentPanel(null)}
              aria-label={lang === "zh" ? "查看评论" : "View comments"}
            >
              <MessageSquare className="w-4 h-4" />
              {comments.length > 0 && (
                <span className="demo-comment-fab-badge">{comments.length}</span>
              )}
            </button>
          )}

          {/* 抽屉 */}
          {commentPanel}

          {/* 遮罩 */}
          {drawerOpen && (
            <div className="demo-comment-overlay" onClick={() => closeDrawer()} />
          )}
        </>,
        document.body,
      )}
    </div>
  );
}

function renderSlashIcon(icon: string) {
  const Icon = iconMap[icon as IconRef];
  return Icon ? <Icon className="w-4 h-4" /> : null;
}
