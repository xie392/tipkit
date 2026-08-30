import { mergeAttributes, Node } from "@tiptap/core";
import type { EditorState, Transaction, TextSelection as TextSelectionType } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/* 脚注扩展（参考 tiptap-footnotes 设计）。
 * 结构：正文中的 inline 原子节点 footnoteReference（上标引用）
 *   + 文档末尾的 footnotes 容器（内含 footnoteItem，每项带唯一 id 与引用对应）。
 * 纯逻辑 + tk-* 语义类名，视觉归主题层。
 *
 * markdown 序列化提示：引用可序列化为 `[^id]`，条目可序列化为
 * `[^id]: 内容`，消费方可在 @tiptap/markdown 的 storage 中自行扩展。 */

export interface FootnoteReferenceAttrs {
  /** 与文末 footnoteItem 的 data-id 对应的唯一标识 */
  id: string;
}

export interface FootnoteItemAttrs {
  id: string;
}

/** setFootnote 选项 */
export interface SetFootnoteOptions {
  /** 指定脚注内容文本；缺省时取当前选区文本 */
  text?: string;
  /** 指定脚注 id；缺省时自动生成 */
  id?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnotes: {
      /** 在光标处插入脚注引用，并在文末维护对应条目 */
      setFootnote: (options?: SetFootnoteOptions) => ReturnType;
      /** 删除指定 id 的脚注引用与文末条目 */
      deleteFootnote: (id: string) => ReturnType;
      /** 光标跳转到文末对应脚注条目 */
      focusFootnote: (id: string) => ReturnType;
    };
  }
}

export const FootnoteReference = Node.create({
  name: "footnoteReference",
  // 高于 Superscript 等 mark 的 parse 规则，避免 sup 标签被 mark 抢占
  priority: 1000,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-footnote-ref" } };
  },

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-id") ?? "",
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
    };
  },

  parseHTML() {
    // PM 级 priority 高于 Superscript 等 mark 规则（mark 规则先注册，
    // 同优先级下会抢占 sup 标签）
    return [{ tag: "sup.tk-footnote-ref", priority: 1001 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-id": (node.attrs as FootnoteReferenceAttrs).id,
      }),
    ];
  },
});

export const FootnoteItem = Node.create({
  name: "footnoteItem",
  // 独占 group，仅允许出现在 footnotes 容器内
  group: "footnote",
  content: "block+",
  defining: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-footnote-item" } };
  },

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-id") ?? "",
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.tk-footnote-item" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-id": (node.attrs as FootnoteItemAttrs).id,
      }),
      0,
    ];
  },
});

export const Footnotes = Node.create({
  name: "footnotes",
  group: "block",
  content: "footnoteItem*",
  defining: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: { class: "tk-footnotes" } };
  },

  parseHTML() {
    return [{ tag: "div.tk-footnotes" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addProseMirrorPlugins() {
    return [
      // 编号插件：按文档顺序给引用/条目注入 data-num（CSS 用 attr() 显示）。
      // 不用 CSS counter——counter 的作用域规则在块级容器/嵌套结构下会重启编号
      new Plugin({
        key: new PluginKey("footnotesNumbering"),
        state: {
          init: (_, state: EditorState) => buildNumberDecorations(state.doc),
          apply: (tr, prev) => (tr.docChanged ? buildNumberDecorations(tr.doc) : prev),
        },
        props: {
          decorations(state: EditorState) {
            return (this as unknown as { getState(d: EditorState): DecorationSet }).getState(state);
          },
        },
      }),
      new Plugin({
        key: new PluginKey("footnotesOrphanCleanup"),
        // 正文引用被删除（退格/删块等任何途径）后，自动清理文末没有引用指向的条目
        appendTransaction(trs: readonly Transaction[], oldState: EditorState, newState: EditorState) {
          if (!trs.some((tr) => tr.docChanged)) return null;
          const collectRefIds = (doc: PMNode) => {
            const ids = new Set<string>();
            doc.descendants((node) => {
              if (node.type.name === "footnoteReference" && node.attrs.id) ids.add(node.attrs.id);
              return true;
            });
            return ids;
          };
          const before = collectRefIds(oldState.doc);
          const after = collectRefIds(newState.doc);
          const deleted: string[] = [];
          before.forEach((id) => {
            if (!after.has(id)) deleted.push(id);
          });
          if (deleted.length === 0) return null;
          const deletedSet = new Set(deleted);
          const targets: { from: number; to: number }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "footnoteItem" && deletedSet.has(node.attrs.id)) {
              targets.push({ from: pos, to: pos + node.nodeSize });
            }
            return true;
          });
          if (targets.length === 0) return null;
          const tr = newState.tr;
          for (let i = targets.length - 1; i >= 0; i -= 1) {
            tr.delete(targets[i].from, targets[i].to);
          }
          // 容器空了就一并移除
          const apply = (doc: PMNode) => {
            let empty: { from: number; to: number } | null = null;
            doc.descendants((node, pos) => {
              if (node.type.name === "footnotes" && node.childCount === 0) {
                empty = { from: pos, to: pos + node.nodeSize };
                return false;
              }
              return true;
            });
            return empty as { from: number; to: number } | null;
          };
          const emptyContainer = apply(tr.doc);
          if (emptyContainer) tr.delete(emptyContainer.from, emptyContainer.to);

          // 条目顺序与引用顺序不一致时重排（保证文末 [1][2][3] 顺序稳定）
          const container = findFootnotesContainer(tr.doc);
          if (container && container.node.childCount > 1) {
            const itemNodes: PMNode[] = [];
            container.node.forEach((child) => itemNodes.push(child));
            const currentIds = itemNodes.map((n) => n.attrs.id);
            const desiredIds = Array.from(after).filter((id) => currentIds.includes(id));
            if (currentIds.join("|") !== desiredIds.join("|")) {
              const start = container.pos + 1;
              const end = container.pos + container.node.nodeSize - 1;
              const sorted = desiredIds
                .map((id) => itemNodes.find((n) => n.attrs.id === id))
                .filter((n): n is PMNode => !!n);
              tr.replaceWith(start, end, sorted);
            }
          }
          return tr;
        },
      }),
    ];
  },

  addCommands() {
    return {
      setFootnote:
        (options?: SetFootnoteOptions) =>
        ({
          state,
          tr,
          dispatch,
        }: {
          state: EditorState;
          tr: Transaction;
          dispatch?: (tr: Transaction) => void;
        }) => {
          const { empty } = state.selection;
          const selectedText = empty ? "" : state.doc.textBetween(state.selection.from, state.selection.to, "\n");
          const text = options?.text ?? selectedText;
          const id = options?.id ?? createFootnoteId();

          const ref = state.schema.nodes.footnoteReference.create({ id });
          const paragraph = text.trim()
            ? state.schema.nodes.paragraph.create(null, state.schema.text(text))
            : state.schema.nodes.paragraph.create();
          const item = state.schema.nodes.footnoteItem.create({ id }, paragraph);

          // 1) 在光标处插入引用
          tr.replaceSelectionWith(ref);

          // 2) 在文末维护 footnotes 容器与条目
          const container = findFootnotesContainer(tr.doc);
          if (container) {
            const insertPos = container.pos + container.node.nodeSize - 1;
            tr.insert(insertPos, item);
          } else {
            const wrapper = state.schema.nodes.footnotes.create(null, item);
            tr.insert(tr.doc.content.size, wrapper);
          }

          if (dispatch) dispatch(tr);
          return true;
        },

      deleteFootnote:
        (id: string) =>
        ({
          state,
          tr,
          dispatch,
        }: {
          state: EditorState;
          tr: Transaction;
          dispatch?: (tr: Transaction) => void;
        }) => {
          // 收集同 id 的引用与条目，从后往前删除
          const targets: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (
              (node.type.name === "footnoteReference" || node.type.name === "footnoteItem") &&
              node.attrs.id === id
            ) {
              targets.push({ from: pos, to: pos + node.nodeSize });
            }
            return true;
          });
          if (targets.length === 0) return false;
          for (let i = targets.length - 1; i >= 0; i -= 1) {
            tr.delete(targets[i].from, targets[i].to);
          }
          if (dispatch) dispatch(tr);
          return true;
        },

      focusFootnote:
        (id: string) =>
        ({
          state,
          tr,
          dispatch,
        }: {
          state: EditorState;
          tr: Transaction;
          dispatch?: (tr: Transaction) => void;
        }) => {
          let target: { pos: number } | null = null;
          state.doc.descendants((node, pos) => {
            if (target) return false;
            if (node.type.name === "footnoteItem" && node.attrs.id === id) {
              target = { pos };
              return false;
            }
            return true;
          });
          if (!target) return false;
          const { pos } = target as { pos: number };
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(pos + 1)) as unknown as TextSelectionType,
          );
          tr.scrollIntoView();
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

function createFootnoteId(): string {
  return `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 在文档中查找 footnotes 容器 */
function findFootnotesContainer(doc: PMNode): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "footnotes") {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/** 便捷组合：一次引入三个节点（引用 / 条目 / 容器），供消费方与测试使用 */
export function createFootnoteExtensions() {
  return [FootnoteReference, FootnoteItem, Footnotes];
}

/** 计算编号装饰：引用按文档顺序 1..n；条目编号 = 其 id 对应引用的序号 */
function buildNumberDecorations(doc: PMNode): DecorationSet {
  const refIds: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === "footnoteReference" && node.attrs.id) refIds.push(node.attrs.id as string);
    return true;
  });
  const numOfId = new Map<string, number>();
  refIds.forEach((id, i) => {
    if (!numOfId.has(id)) numOfId.set(id, i + 1);
  });
  const decos: Decoration[] = [];
  let orphanSeq = refIds.length;
  doc.descendants((node, pos) => {
    if (node.type.name === "footnoteReference") {
      const n = numOfId.get(node.attrs.id as string) ?? 0;
      decos.push(Decoration.inline(pos, pos + node.nodeSize, { "data-num": String(n) }));
    } else if (node.type.name === "footnoteItem") {
      let n = numOfId.get(node.attrs.id as string);
      if (n == null) n = ++orphanSeq;
      decos.push(Decoration.node(pos, pos + node.nodeSize, { "data-num": String(n) }));
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}
