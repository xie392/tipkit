import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/* 折叠块（迁移自 blog rich-text/ext/details.ts）：details + summary + content。 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType;
    };
  }
}

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
    return ({ node, HTMLAttributes, editor, view }) => {
      const dom = document.createElement("details");
      dom.setAttribute("data-type", "details");
      dom.className = "tk-details";
      let isOpen = !!node.attrs.open;
      if (isOpen) dom.setAttribute("open", "open");
      Object.entries(HTMLAttributes).forEach(([k, v]) => {
        if (v != null && typeof v === "string") dom.setAttribute(k, v);
      });

      // 箭头区域宽度（与 summary::before 的箭头+margin 对齐，约 28px）
      const ARROW_ZONE = 28;

      // 必须在 mousedown 阶段拦截：
      // 浏览器原生 <summary> 在 mousedown 就会 toggle <details> open 状态，
      // 等到 click 事件时内容已经被折叠、焦点已丢失，无法把光标放进标题。
      const onMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const summary = target.closest("summary");
        if (!summary || !dom.contains(summary)) return;

        const rect = summary.getBoundingClientRect();
        const inArrowZone = e.clientX - rect.left < ARROW_ZONE;
        if (inArrowZone) {
          // 箭头区域：交给浏览器原生 toggle（mousedown 默认行为会切换 open）
          return;
        }

        // 文字区域：阻止原生 toggle，手动把光标定位到点击处
        e.preventDefault();

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
      dom.addEventListener("keydown", onKeyDown);

      // 箭头区域走原生 toggle 后，同步 open 属性到节点
      const onToggle = () => {
        const nowOpen = dom.hasAttribute("open");
        if (nowOpen !== isOpen) {
          isOpen = nowOpen;
          editor.commands.updateAttributes("details", { open: nowOpen });
        }
      };
      dom.addEventListener("toggle", onToggle);

      return {
        dom,
        contentDOM: dom,
        // 外部（如命令/撤销/其他 NodeView）更新 open 属性时同步 DOM
        update(updatedNode: typeof node) {
          if (updatedNode.type !== node.type) return false;
          const next = !!updatedNode.attrs.open;
          if (next !== isOpen) {
            isOpen = next;
            if (next) dom.setAttribute("open", "open");
            else dom.removeAttribute("open");
          }
          return true;
        },
        destroy() {
          dom.removeEventListener("mousedown", onMouseDown);
          dom.removeEventListener("keydown", onKeyDown);
          dom.removeEventListener("toggle", onToggle);
        },
        ignoreMutation: (mutation) =>
          mutation.type === "attributes" &&
          (mutation as MutationRecord).attributeName === "open",
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
