import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { Translate } from "@tipkit/core";

/* 折叠块（迁移自 blog rich-text/ext/details.ts）：details + summary + content。 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType;
    };
  }
}

/* 悬停工具栏图标（与 ui 包 block-actions 图标同风格，此处内联避免跨包依赖） */
const ICON_CHEVRON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
const ICON_COPY =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1.5"/></svg>';
const ICON_TRASH =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1"/><path d="M4.5 4.5l.7 8a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-8"/><path d="M6.5 7v4M9.5 7v4"/></svg>';

/** 折叠块容器：基于 <details> 实现，summary + 多个内容块 */
export const Details = Node.create({
  name: "details",

  group: "block",

  content: "detailsSummary detailsContent+",

  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => (el as HTMLElement).getAttribute("open") !== null,
        renderHTML: (attrs) => (attrs.open ? { open: "open" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details[data-type='details']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, { "data-type": "details", class: "tk-details" }),
      0,
    ];
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: "details",
            attrs: { open: true },
            content: [
              { type: "detailsSummary", content: [{ type: "text", text: "折叠标题" }] },
              {
                type: "detailsContent",
                content: [{ type: "paragraph" }],
              },
            ],
          }),
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, editor, view, getPos }) => {
      // 原生 NodeView 无法用 useT()，t 由 TipKitEditor 挂到 editor 实例（__tipkitT）
      const getT = (): Translate =>
        (editor as unknown as { __tipkitT?: Translate }).__tipkitT ?? ((k) => k);

      // 外壳 div：悬停工具栏 + 内容 DOM（<details>）。工具栏必须放在
      // contentDOM 之外，否则会被 ProseMirror 的内容同步逻辑当成节点内容处理。
      const wrap = document.createElement("div");
      wrap.className = "tk-details-wrap";

      const dom = document.createElement("details");
      dom.setAttribute("data-type", "details");
      dom.className = "tk-details";
      let isOpen = !!node.attrs.open;
      if (isOpen) dom.setAttribute("open", "open");
      Object.entries(HTMLAttributes).forEach(([k, v]) => {
        if (v != null && typeof v === "string") dom.setAttribute(k, v);
      });

      // ---- 悬停小工具栏（展开/折叠、复制、删除）----
      const toolbar = document.createElement("div");
      toolbar.className = "tk-details-toolbar";
      toolbar.contentEditable = "false";
      toolbar.hidden = true;

      const makeBtn = (className: string, html: string) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = className;
        btn.innerHTML = html;
        // 阻止 mousedown 默认行为，避免点击工具栏把编辑器焦点/选区弄丢
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        return btn;
      };

      const toggleBtn = makeBtn("tk-ct-btn", ICON_CHEVRON);
      const duplicateBtn = makeBtn("tk-ct-btn", ICON_COPY);
      const deleteBtn = makeBtn("tk-ct-btn is-danger", ICON_TRASH);

      const sep = document.createElement("span");
      sep.className = "tk-ct-sep";

      toolbar.append(toggleBtn, sep, duplicateBtn, deleteBtn);
      wrap.append(toolbar, dom);

      // 刷新 tooltip 文案：每次悬停/语言切换时重新读取最新 t，保证实时生效
      const refreshTips = () => {
        const t = getT();
        const toggleLabel = t(isOpen ? "details.collapse" : "details.expand");
        toggleBtn.setAttribute("data-tip", toggleLabel);
        toggleBtn.setAttribute("aria-label", toggleLabel);
        duplicateBtn.setAttribute("data-tip", t("details.duplicate"));
        duplicateBtn.setAttribute("aria-label", t("details.duplicate"));
        deleteBtn.setAttribute("data-tip", t("details.delete"));
        deleteBtn.setAttribute("aria-label", t("details.delete"));
      };
      refreshTips();

      const syncToolbar = () => {
        toggleBtn.classList.toggle("is-open", isOpen);
      };
      syncToolbar();

      // 悬停显示工具栏（只读时不显示）
      const onWrapEnter = () => {
        if (!editor.isEditable) return;
        refreshTips();
        toolbar.hidden = false;
        wrap.classList.add("is-hovered");
      };
      const onWrapLeave = () => {
        toolbar.hidden = true;
        wrap.classList.remove("is-hovered");
      };
      wrap.addEventListener("mouseenter", onWrapEnter);
      wrap.addEventListener("mouseleave", onWrapLeave);

      // 语言切换时即时刷新 tooltip 文案（TipKitEditor 在 deps.t 变化时派发 tipkit:langChange）
      const onLangChange = () => refreshTips();
      view.dom.addEventListener("tipkit:langChange", onLangChange);

      // 箭头区域宽度（与 summary::before 的箭头+padding 对齐，约 34px）
      const ARROW_ZONE = 34;

      const setOpen = (next: boolean) => {
        isOpen = next;
        if (next) dom.setAttribute("open", "open");
        else dom.removeAttribute("open");
        syncToolbar();
      };

      const toggleOpen = () => {
        const next = !isOpen;
        setOpen(next);
        // 必须按节点自身位置精确更新。updateAttributes 会按当前选区范围
        // 批量更新，选区一旦横跨多个折叠块，所有折叠块都会被一起改。
        const pos = getPos();
        if (typeof pos === "number") {
          const tr = editor.state.tr.setNodeMarkup(pos, undefined, { open: next });
          editor.view.dispatch(tr);
        }
      };

      const onToggleClick = (e: MouseEvent) => {
        e.preventDefault();
        toggleOpen();
      };

      const onDuplicateClick = (e: MouseEvent) => {
        e.preventDefault();
        const pos = getPos();
        if (typeof pos === "number") {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .insertContentAt(pos + node.nodeSize, node.toJSON())
            .run();
        }
      };

      const onDeleteClick = (e: MouseEvent) => {
        e.preventDefault();
        const pos = getPos();
        if (typeof pos === "number") {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .deleteRange({ from: pos, to: pos + node.nodeSize })
            .run();
        }
      };

      toggleBtn.addEventListener("click", onToggleClick);
      duplicateBtn.addEventListener("click", onDuplicateClick);
      deleteBtn.addEventListener("click", onDeleteClick);

      // 必须在 mousedown 阶段拦截：
      // 浏览器原生 <summary> 在 mousedown 就会 toggle <details> open 状态，
      // 等到 click 事件时内容已经被折叠、焦点已丢失，无法把光标放进标题。
      const onMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const summary = target.closest("summary");
        if (!summary || !dom.contains(summary)) return;

        // 完全阻止浏览器原生 toggle，所有切换由我们手动控制
        e.preventDefault();

        const rect = summary.getBoundingClientRect();
        const inArrowZone = e.clientX - rect.left < ARROW_ZONE;
        if (inArrowZone) {
          // 箭头区域：手动 toggle
          toggleOpen();
          return;
        }

        // 文字区域：手动把光标定位到点击处
        const posAtCoords = view.posAtCoords({
          left: e.clientX,
          top: e.clientY,
        });
        if (posAtCoords) {
          const tr = view.state.tr.setSelection(
            TextSelection.create(view.state.doc, posAtCoords.pos),
          );
          view.dispatch(tr.scrollIntoView());
          view.focus();
        } else {
          // 兜底：把光标放到 summary 末尾
          const summaryPos = view.posAtDOM(summary, 0);
          if (summaryPos != null) {
            const $pos = view.state.doc.resolve(summaryPos);
            const end = $pos.after();
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, end),
            );
            view.dispatch(tr.scrollIntoView());
            view.focus();
          }
        }
      };

      // click 阶段也要拦截，防止浏览器在 summary 上的原生 toggle 行为
      const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const summary = target.closest("summary");
        if (summary && dom.contains(summary)) {
          e.preventDefault();
        }
      };

      // 键盘操作：空格/回车在 summary 上原生会 toggle，阻止以允许输入空格
      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== "SUMMARY" || !dom.contains(target)) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (e.key === " ") {
            editor.commands.insertContent(" ");
          }
        }
      };

      dom.addEventListener("mousedown", onMouseDown);
      dom.addEventListener("click", onClick);
      dom.addEventListener("keydown", onKeyDown);

      return {
        dom: wrap,
        contentDOM: dom,
        // 外部（如命令/撤销/其他 NodeView）更新 open 属性时同步 DOM
        update(updatedNode: typeof node) {
          if (updatedNode.type !== node.type) return false;
          const next = !!updatedNode.attrs.open;
          if (next !== isOpen) setOpen(next);
          return true;
        },
        destroy() {
          wrap.removeEventListener("mouseenter", onWrapEnter);
          wrap.removeEventListener("mouseleave", onWrapLeave);
          view.dom.removeEventListener("tipkit:langChange", onLangChange);
          toggleBtn.removeEventListener("click", onToggleClick);
          duplicateBtn.removeEventListener("click", onDuplicateClick);
          deleteBtn.removeEventListener("click", onDeleteClick);
          dom.removeEventListener("mousedown", onMouseDown);
          dom.removeEventListener("click", onClick);
          dom.removeEventListener("keydown", onKeyDown);
        },
        ignoreMutation: (mutation) => {
          if (mutation.type === "attributes") {
            const target = mutation.target as HTMLElement;
            // wrap / toolbar 及其内部子元素（按钮等）的属性变化
            // （悬停类、工具栏 hidden、按钮 data-tip/aria-label 等）不能触发
            // ProseMirror 重建，否则 is-hovered 被新 dom 重置，工具栏永远不显示
            if (target === wrap || target === toolbar || toolbar.contains(target)) return true;
            return (mutation as MutationRecord).attributeName === "open";
          }
          return false;
        },
      };
    };
  },
});

/** 折叠块标题：渲染为 <summary> */
export const DetailsSummary = Node.create({
  name: "detailsSummary",

  content: "inline*",

  defining: true,

  selectable: false,

  draggable: false,

  parseHTML() {
    return [{ tag: "summary[data-type='summary']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes, { "data-type": "summary", class: "tk-details-summary" }),
      0,
    ];
  },
});

/** 折叠块正文：可放任意 block */
export const DetailsContent = Node.create({
  name: "detailsContent",

  content: "block+",

  defining: true,

  selectable: false,

  draggable: false,

  parseHTML() {
    return [{ tag: "div[data-type='details-content']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "details-content",
        class: "tk-details-content",
      }),
      0,
    ];
  },
});

export default Details;
