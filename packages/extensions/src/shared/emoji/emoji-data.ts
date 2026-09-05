/* 精选常用集在 emoji-common.ts；本文件合并常用集与全量集，提供检索 API。 */
/* ─── 全量 emoji 字典（约 1900 个，数据移植自 https://github.com/pileax-ai/yiitap，MIT）───
 * 精选常用集在前（保持既有 :name: 短代码兼容），全量集紧随其后；
 * keywords 取自官方英文名单词，用于搜索。 */
import emojiFullJson from "./emoji-data-full.json";
import { emojisToName } from "./emoji-common";

export { emojisToName };

export interface EmojiEntry {
  name: string;
  emoji: string;
  keywords?: string[];
  /** 分组 slug（全量数据自带；精选集归入 common） */
  group?: string;
}

const emojiFull = emojiFullJson as EmojiEntry[];

/** 精选常用集数量（emojiLibrary 前 N 个），用于"常用"分组 */
export const COMMON_EMOJI_COUNT = emojisToName.length;

/* 箭头/符号类字符（↔ ↕ ⬅ ⌨ 等）默认是文本呈现，缺 U+FE0F 时浏览器会
 * 渲染成蓝色普通字形而非彩色 emoji；纯 BMP 字符补上变体选择符强制 emoji 呈现。 */
function normalizeGlyph(glyph: string): string {
  if (glyph.includes("\uFE0F") || glyph.includes("\u200D")) return glyph;
  const bmpOnly = [...glyph].every((ch) => (ch.codePointAt(0) ?? 0) < 0x10000);
  return bmpOnly ? glyph + "\uFE0F" : glyph;
}

export const emojiLibrary: EmojiEntry[] = [
  ...emojisToName.map((e) => ({ ...e, emoji: normalizeGlyph(e.emoji), group: "common" })),
  ...emojiFull
    .filter((e) => !emojisToName.some((c) => c.name === e.name || c.emoji === e.emoji))
    .map((e) => ({ ...e, emoji: normalizeGlyph(e.emoji) })),
];

export interface EmojiGroup {
  id: string;
  icon: string;
  labelKey: string;
}

/** 底部分类切换条（常用 + 9 大官方分组），icon 直接用 emoji 字符 */
export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: "common", icon: "🕘", labelKey: "emoji.group.common" },
  { id: "smileys_emotion", icon: "😀", labelKey: "emoji.group.smileys" },
  { id: "people_body", icon: "👋", labelKey: "emoji.group.people" },
  { id: "animals_nature", icon: "🐻", labelKey: "emoji.group.animals" },
  { id: "food_drink", icon: "🍔", labelKey: "emoji.group.food" },
  { id: "travel_places", icon: "🚗", labelKey: "emoji.group.travel" },
  { id: "activities", icon: "⚽", labelKey: "emoji.group.activities" },
  { id: "objects", icon: "💡", labelKey: "emoji.group.objects" },
  { id: "symbols", icon: "🔔", labelKey: "emoji.group.symbols" },
  { id: "flags", icon: "🚩", labelKey: "emoji.group.flags" },
];

/** 根据查询字符串搜索 emoji（名字 / 英文关键词包含，下划线与空格等价） */
function matchEmoji(e: EmojiEntry, q: string) {
  const normalized = q.replace(/_/g, " ");
  if (e.name.replace(/_/g, " ").includes(normalized)) return true;
  return (e.keywords ?? []).some((k) => k.includes(normalized));
}

export function emojiSearch(query: string, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return emojiLibrary.slice(0, limit);
  return emojiLibrary.filter((e) => matchEmoji(e, q)).slice(0, limit);
}

/** 无截断的过滤（联想浮层用，自行控制展示条数） */
export function emojiFilter(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return emojiLibrary;
  return emojiLibrary.filter((e) => matchEmoji(e, q));
}

/** 按分组取列表（搜索时用 emojiFilter 代替） */
export function emojiByGroup(group: string) {
  return group === "common"
    ? emojiLibrary.slice(0, COMMON_EMOJI_COUNT)
    : emojiLibrary.filter((e) => e.group === group);
}
