import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

export const uniqueIdKey = new PluginKey("uniqueId");

export interface UniqueIDOptions {
  /** 需要携带 id 的节点类型 */
  types: string[];
  /** 自定义 id 生成器 */
  generateID?: () => string;
  /** id 属性名 */
  attributeName: string;
}

function defaultGenerateID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `id_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * UniqueID（对标 Tiptap Pro UniqueID 的开源实现）：
 * 为指定块级节点自动补 `id` attr，用于评论锚点、协同定位、目录跳转等场景。
 * opt-in 扩展：不进 basic/advanced 集合，由消费方按需启用。
 */
export const UniqueID = Extension.create<UniqueIDOptions>({
  name: "uniqueId",

  addOptions() {
    return {
      types: ["paragraph", "heading", "blockquote", "listItem", "taskItem", "codeBlock", "imageBlock", "callout"],
      attributeName: "id",
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element) => element.getAttribute(`data-${this.options.attributeName}`),
            renderHTML: (attributes) => {
              const id = attributes[this.options.attributeName];
              if (!id) return {};
              return { [`data-${this.options.attributeName}`]: id };
            },
          },
        },
      },
    ];
  },

  onCreate() {
    // 初始内容不走事务；view 挂载完成前 dispatch 可能不生效，带重试补 id
    const { types, attributeName, generateID } = this.options;
    const getId = generateID ?? defaultGenerateID;
    const attempt = (n: number) => {
      if (this.editor.isDestroyed || n <= 0) return;
      const state = this.editor.state;
      const tr = fillMissingIds(state.tr, state.doc, types, attributeName, getId);
      if (!tr) return;
      this.editor.view.dispatch(tr);
      if (fillMissingIds(this.editor.state.tr, this.editor.state.doc, types, attributeName, getId)) {
        setTimeout(() => attempt(n - 1), 25);
      }
    };
    setTimeout(() => attempt(10), 0);
  },

  addProseMirrorPlugins() {
    const { types, attributeName, generateID } = this.options;
    const getId = generateID ?? defaultGenerateID;

    return [
      new Plugin({
        key: uniqueIdKey,
        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;
          return fillMissingIds(newState.tr, newState.doc, types, attributeName, getId);
        },
      }),
    ];
  },
});

/** 扫描 doc 中缺 id 的目标节点并补齐；重复 id（如回车拆分复制 attrs）与已有 id 的节点处理：
 * 已有 id 永不覆盖，重复 id 从第二个起重新生成。无变更返回 null。 */
function fillMissingIds(
  tr: Transaction,
  doc: PMNode,
  types: string[],
  attributeName: string,
  getId: () => string,
): Transaction | null {
  const allIds = new Set<string>();
  const seen = new Set<string>();
  doc.descendants((node) => {
    const id = node.attrs[attributeName];
    if (id) allIds.add(id as string);
  });

  let modified = false;
  const assign = (node: PMNode, pos: number) => {
    let newId = getId();
    while (allIds.has(newId)) newId = getId();
    allIds.add(newId);
    seen.add(newId);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attributeName]: newId });
    modified = true;
  };

  doc.descendants((node, pos) => {
    if (!types.includes(node.type.name)) return;
    const id = node.attrs[attributeName] as string | null;
    // 首次出现的 id 保留；缺 id 或重复 id（拆分节点时 attrs 被复制）重新生成
    if (id && !seen.has(id)) {
      seen.add(id);
      return;
    }
    assign(node, pos);
  });

  return modified ? tr : null;
}

export type { UniqueIDOptions as UniqueIdOptions };
