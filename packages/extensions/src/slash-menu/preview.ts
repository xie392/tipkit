import type { Translate } from "@tipkit/core";

/* 斜杠菜单右侧预览面板 HTML。
 * 颜色一律使用主题 CSS 变量（--foreground/--muted/--border/--primary 等），
 * 由 @tipkit/themes 决定实际视觉，本文件不出现硬编码色值。 */

const CARD = "background:var(--card,#fff);border-radius:6px";
const BAR_A = "height:6px;border-radius:3px;background:var(--border,#e5e7eb)";
const TEXT = "font-size:11px;color:var(--foreground,#111)";
const TEXT_MUTED = "font-size:11px;color:var(--muted-foreground,#6b7280)";

export function previewAI(): string {
  return `<div style="${CARD};padding:16px;display:flex;align-items:center;justify-content:center;gap:6px"><span style="font-size:14px">✨</span><span style="height:6px;width:64px;border-radius:3px;background:var(--border,#e5e7eb)"></span><span style="height:6px;width:44px;border-radius:3px;background:var(--muted,#f3f4f6)"></span></div>`;
}

export function previewHeading(level: 1 | 2 | 3 | 4, t: Translate): string {
  const size = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 12;
  return `<div style="${CARD};padding:12px"><div style="font-size:${size}px;font-weight:700;line-height:1.25;color:var(--foreground,#111)">${t(`slash.heading${level}.label`)}</div><div style="margin-top:6px;${BAR_A};width:100%"></div><div style="margin-top:4px;${BAR_A};width:78%"></div></div>`;
}

export function previewParagraph(): string {
  return `<div style="${CARD};padding:12px"><div style="${BAR_A};width:100%;background:var(--border,#d1d5db)"></div><div style="margin-top:6px;${BAR_A};width:100%"></div><div style="margin-top:6px;${BAR_A};width:60%"></div></div>`;
}

export function previewBulletList(): string {
  const row = (text: string) =>
    `<div style="display:flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:var(--muted-foreground,#6b7280);flex-shrink:0"></span><span style="${TEXT}">${text}</span></div>`;
  return `<div style="${CARD};padding:12px;display:flex;flex-direction:column;gap:8px">${row("•")}${row("••")}${row("•••")}</div>`;
}

export function previewOrderedList(): string {
  const row = (n: string) =>
    `<div style="display:flex;align-items:center;gap:8px"><span style="width:12px;flex-shrink:0;font-size:11px;font-weight:500;color:var(--muted-foreground,#6b7280)">${n}</span><span style="height:5px;flex:1;border-radius:3px;background:var(--muted,#f3f4f6)"></span></div>`;
  return `<div style="${CARD};padding:12px;display:flex;flex-direction:column;gap:8px">${row("1.")}${row("2.")}${row("3.")}</div>`;
}

export function previewTaskList(): string {
  const done =
    '<div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;background:var(--primary,#22c55e);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--primary-foreground,#fff);font-size:9px">✓</span><span style="font-size:11px;color:var(--muted-foreground,#9ca3af);text-decoration:line-through">✓✓✓</span></div>';
  const todo = (text: string) =>
    `<div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid var(--border,#d1d5db);flex-shrink:0"></span><span style="${TEXT}">${text}</span></div>`;
  return `<div style="${CARD};padding:12px;display:flex;flex-direction:column;gap:8px">${done}${todo("○")}${todo("○○")}</div>`;
}

export function previewStatus(t: Translate): string {
  return `<div style="${CARD};padding:16px;display:flex;align-items:center;justify-content:center"><span style="display:inline-block;background:var(--muted,#ffcccc);border-radius:4px;padding:2px 8px;font-size:11px;color:var(--foreground,#111)">${t("slash.status.label")}</span></div>`;
}

export function previewBlockquote(): string {
  return `<div style="${CARD};padding:12px"><div style="border-left:3px solid var(--foreground,#111);padding-left:10px"><div style="${TEXT_MUTED};font-style:italic;line-height:1.6">“……</div></div></div>`;
}

export function previewCodeBlock(): string {
  return `<div style="background:var(--muted,#f3f4f6);border-radius:6px;padding:12px;font-family:monospace;font-size:10px;line-height:1.7"><div><span style="color:var(--primary)">const</span> <span style="color:var(--foreground)">greet</span> = () =&gt; &#123;</div><div style="padding-left:12px"><span style="color:var(--muted-foreground)">// Hello</span></div><div style="padding-left:12px"><span style="color:var(--primary)">return</span> <span style="color:var(--foreground)">"Hi"</span>;</div><div>&#125;;</div></div>`;
}

export function previewTable(): string {
  const th =
    `style="border:1px solid var(--border,#e5e7eb);padding:4px 6px;background:var(--muted,#f9fafb);text-align:left;color:var(--muted-foreground,#6b7280)"`;
  const td = `style="border:1px solid var(--border,#f3f4f6);padding:4px 6px;color:var(--muted-foreground,#6b7280)"`;
  return `<div style="${CARD};padding:8px"><table style="border-collapse:collapse;width:100%;font-size:9px"><tr><th ${th}>A</th><th ${th}>B</th><th ${th}>C</th></tr><tr><td ${td}>1</td><td ${td}>2</td><td ${td}>3</td></tr><tr><td ${td}>4</td><td ${td}>5</td><td ${td}>6</td></tr></table></div>`;
}

export function previewImage(): string {
  return `<div style="${CARD};overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:72px;background:var(--muted,#f3f4f6)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--muted-foreground,#9ca3af)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div></div>`;
}

export function previewLink(t: Translate): string {
  return `<div style="${CARD};padding:16px;display:flex;align-items:center;justify-content:center"><span style="display:inline-flex;align-items:center;gap:4px;background:color-mix(in srgb, var(--primary) 12%, transparent);padding:4px 8px;border-radius:6px;font-size:11px;color:var(--primary,#2563eb);text-decoration:underline">${t("slash.link.label")}</span></div>`;
}

export function previewColumns(): string {
  const col = (w: string) =>
    `<div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:6px;width:100%;border-radius:3px;background:var(--border,#d1d5db)"></div><div style="height:6px;width:${w};border-radius:3px;background:var(--muted,#e5e7eb)"></div></div>`;
  return `<div style="${CARD};padding:10px;display:flex;gap:8px">${col("72%")}<div style="width:1px;background:var(--border,#e5e7eb)"></div>${col("64%")}</div>`;
}

export function previewDetails(): string {
  return `<div style="${CARD};padding:12px;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 12 12" width="10" height="10" fill="var(--muted-foreground,#6b7280)"><path d="M4 2l4 4-4 4z"/></svg><span style="height:6px;flex:1;border-radius:3px;background:var(--muted,#f3f4f6)"></span></div>`;
}

export function previewTOC(): string {
  const row = (pl: string, dotBg: string, barBg: string, w: string) =>
    `<div style="display:flex;align-items:center;gap:8px;${pl}"><span style="width:5px;height:5px;border-radius:50%;background:${dotBg}"></span><span style="height:5px;width:${w};border-radius:3px;background:${barBg}"></span></div>`;
  return `<div style="${CARD};padding:12px;display:flex;flex-direction:column;gap:6px">${row("", "var(--muted-foreground,#9ca3af)", "var(--border,#d1d5db)", "64px")}${row("padding-left:12px", "var(--border,#d1d5db)", "var(--muted,#e5e7eb)", "48px")}${row("", "var(--muted-foreground,#9ca3af)", "var(--border,#d1d5db)", "80px")}</div>`;
}

export function previewCallout(t: Translate): string {
  return `<div style="display:flex;gap:8px;border-radius:6px;background:color-mix(in srgb, var(--primary) 8%, var(--card,#fffbeb));padding:10px"><span style="font-size:14px">💡</span><div style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:11px;font-weight:500;color:var(--foreground,#92400e)">${t("slash.callout.label")}</span><span style="height:5px;width:100%;border-radius:3px;background:color-mix(in srgb, var(--primary) 25%, transparent)"></span><span style="height:5px;width:72%;border-radius:3px;background:color-mix(in srgb, var(--primary) 25%, transparent)"></span></div></div>`;
}

export function previewKatex(): string {
  return `<div style="${CARD};padding:16px;display:flex;align-items:center;justify-content:center"><span style="font-size:18px;font-style:italic;color:var(--foreground,#111)">E = mc²</span></div>`;
}

export function previewIframe(): string {
  return `<div style="${CARD};overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:64px;background:var(--muted,#f3f4f6)"><span style="font-size:10px;color:var(--muted-foreground,#9ca3af)">🔗</span></div></div>`;
}

export function previewVideo(): string {
  return `<div style="${CARD};overflow:hidden"><div style="display:flex;align-items:center;justify-content:center;height:64px;background:var(--foreground,#111827)"><svg width="22" height="22" viewBox="0 0 24 24" fill="var(--background,#fff)"><path d="M8 5v14l11-7z"/></svg></div></div>`;
}

export function previewAttachment(): string {
  return `<div style="${CARD};padding:12px"><div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:8px"><span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:color-mix(in srgb, var(--destructive) 12%, transparent);font-size:10px;font-weight:700;color:var(--destructive,#ef4444)">PDF</span><span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="height:5px;width:80px;border-radius:3px;background:var(--border,#d1d5db)"></span><span style="height:4px;width:40px;border-radius:2px;background:var(--muted,#e5e7eb)"></span></span></div></div>`;
}

export function previewEmoji(): string {
  return `<div style="${CARD};padding:16px;display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:20px">😀</span><span style="font-size:20px">🎉</span><span style="font-size:20px">❤️</span><span style="font-size:20px">🔥</span><span style="font-size:20px">✨</span></div>`;
}

export function previewCanvas(): string {
  return `<div style="${CARD};padding:12px"><div style="border:1px solid var(--border,#e5e7eb);border-radius:6px;height:72px;position:relative;overflow:hidden;background:var(--muted,#f8fafc)"><div style="position:absolute;left:6px;top:6px;width:20px;height:20px;border:1.5px solid var(--primary,#2563eb);border-radius:3px"></div><div style="position:absolute;left:40px;top:10px;width:26px;height:16px;border:1.5px solid var(--muted-foreground,#9ca3af);border-radius:3px"></div><div style="position:absolute;left:14px;top:34px;width:36px;height:1.5px;background:var(--primary,#2563eb);transform:rotate(-12deg)"></div><div style="position:absolute;left:52px;top:44px;width:1.5px;height:14px;background:var(--muted-foreground,#9ca3af)"></div></div></div>`;
}

export function previewFootnote(): string {
  return `<div style="${CARD};padding:12px"><div style="${TEXT};line-height:1.6">——<span style="font-size:9px;vertical-align:super;color:var(--primary,#2563eb)">[1]</span></div><div style="margin-top:8px;border-top:1px solid var(--border,#e5e7eb);padding-top:6px"><div style="display:flex;gap:6px;align-items:center"><span style="font-size:9px;color:var(--muted-foreground,#9ca3af)">[1]</span><span style="height:5px;width:64px;border-radius:3px;background:var(--muted,#e5e7eb)"></span></div></div></div>`;
}
