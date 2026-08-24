/**
 * TipKit 国际化字典类型。
 *
 * key 使用扁平的 dot notation（如 "toolbar.undo"），
 * 消费方可展开覆盖：`{ ...zh, "toolbar.undo": "Undo" }`。
 */
export type Messages = Record<string, string>;

/** t() 翻译函数签名 */
export type Translate = (key: string) => string;

/**
 * 创建翻译函数。
 * 传入字典，返回 t(key) —— 未命中时返回 key 本身（降级）。
 */
export function createT(messages: Messages): Translate {
  return (key: string) => messages[key] ?? key;
}
