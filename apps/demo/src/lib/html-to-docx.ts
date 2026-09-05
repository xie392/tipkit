import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";


/* Demo 内置的「编辑器 DOM → docx」转换器。
 * 直接读取编辑器真实 DOM 的计算样式（颜色/字号/加粗/斜体/对齐/背景），
 * 主题层使用的 lab()/oklch() 颜色在此换算为 sRGB hex，使导出结果贴近编辑器观感。 */

const FONT_FALLBACK = "Calibri";
const FONT_MONO = "Courier New";

/* ── 颜色换算：CSS 计算值（lab / oklch / color(srgb) / rgb / hex）→ RRGGBB ── */

export function cssColorToHex(input: string): string | null {
  const v = input.trim();
  if (v.startsWith("#")) {
    const h = v.slice(1);
    if (h.length === 3) return (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toUpperCase();
    if (h.length >= 6) return h.slice(0, 6).toUpperCase();
    return null;
  }
  const m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return rgbToHex(parts[0], parts[1], parts[2]);
  }
  if (v.startsWith("lab(")) return labToHex(parseNums(v));
  if (v.startsWith("oklch(")) return oklchToHex(parseNums(v));
  const cm = v.match(/^color\((srgb|display-p3)\s+([^)]+)\)$/i);
  if (cm) {
    const parts = cm[2].split(/[\s,/]+/).filter(Boolean).map(Number);
    return rgbToHex(parts[0] * 255, parts[1] * 255, parts[2] * 255);
  }
  return null;
}

function parseNums(v: string): number[] {
  return v.slice(v.indexOf("(") + 1, v.lastIndexOf(")")).split(/[\s,/]+/).filter(Boolean).map(Number);
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return (to(r) + to(g) + to(b)).toUpperCase();
}

// CSS lab() 使用 D50 白点
function labToHex([L, a, b]: number[]): string {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const yr = L > kappa * epsilon ? ((L + 16) / 116) ** 3 : L / kappa;
  const zr = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
  const X = xr * 0.9642956764295677;
  const Y = yr * 1;
  const Z = zr * 0.8251046025104602;
  // XYZ(D50) → linear sRGB
  const rl = 3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z;
  const gl = -0.9787684 * X + 1.9161415 * Y + 0.033454 * Z;
  const bl = 0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z;
  return rgbToHex(gamma(rl) * 255, gamma(gl) * 255, gamma(bl) * 255);
}

// oklch → oklab → linear sRGB（Björn Ottosson 矩阵）
function oklchToHex([L, C, H]: number[]): string {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return rgbToHex(gamma(rl) * 255, gamma(gl) * 255, gamma(bl) * 255);
}

function gamma(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
}

/* ── 计算样式读取 ── */

interface TextStyle {
  text: string;
  color: string | null;
  sizeHalfPt: number | null;
  bold: boolean;
  italics: boolean;
  underline: boolean;
  strike: boolean;
  font: string;
}

function styleOfText(el: Element, text: string): TextStyle {
  const cs = getComputedStyle(el);
  const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const isMono = /monospace|courier/i.test(cs.fontFamily);
  return {
    text,
    color: cssColorToHex(cs.color),
    sizeHalfPt: Math.round(parseFloat(cs.fontSize) * 0.75 * 2),
    bold: Number(cs.fontWeight) >= 600,
    italics: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
    underline: cs.textDecorationLine.includes("underline"),
    strike: cs.textDecorationLine.includes("line-through"),
    font: isMono ? FONT_MONO : family || FONT_FALLBACK,
  };
}

function toRun(s: TextStyle): TextRun {
  return new TextRun({
    text: s.text,
    bold: s.bold || undefined,
    italics: s.italics || undefined,
    underline: s.underline ? {} : undefined,
    strike: s.strike || undefined,
    color: s.color ?? undefined,
    size: s.sizeHalfPt ?? undefined,
    font: s.font,
  });
}

function sameStyle(a: TextStyle, b: TextStyle): boolean {
  return (
    a.color === b.color && a.sizeHalfPt === b.sizeHalfPt && a.bold === b.bold &&
    a.italics === b.italics && a.underline === b.underline && a.strike === b.strike && a.font === b.font
  );
}

/** 合并相邻同样式的 run，避免 docx 里碎片化 */
function mergeRuns(runs: TextStyle[]): TextRun[] {
  const merged: TextStyle[] = [];
  for (const r of runs) {
    if (r.text.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last && sameStyle(last, r)) last.text += r.text;
    else merged.push({ ...r });
  }
  return merged.map(toRun);
}

/** 收集一个块内所有文本节点（跳过嵌套列表/表格），按计算样式生成 runs */
function collectRuns(root: Element): TextRun[] {
  const runs: TextStyle[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const parent = node.parentElement;
      if (!parent || text.length === 0) return;
      // 任务项的 <label> 里是视觉隐藏的无障碍文案，会造成内容重复
      if (parent.closest("label")) return;
      // 纯空白文本节点：HTML 渲染时折叠为一个空格，docx 里也输出一个空格，
      // 否则语法高亮的相邻 span 之间会丢失空格（export default → exportdefault）
      if (!text.trim()) {
        runs.push(styleOfText(parent, " "));
        return;
      }
      runs.push(styleOfText(parent, text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol" || tag === "table" || tag === "label" || tag === "input") return;
    if (tag === "br") {
      runs.push({ text: "\n", color: null, sizeHalfPt: null, bold: false, italics: false, underline: false, strike: false, font: FONT_FALLBACK });
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return mergeRuns(runs);
}

/* ── 图片 / SVG ── */

async function imageToRun(img: HTMLImageElement): Promise<ImageRun | null> {
  const src = img.getAttribute("src");
  if (!src) return null;
  try {
    let data: Uint8Array;
    if (src.startsWith("data:")) {
      data = base64ToBytes(src.slice(src.indexOf(",") + 1));
    } else {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) return null;
      data = new Uint8Array(await res.arrayBuffer());
    }
    const bitmap = await createImageBitmap(new Blob([data.buffer as ArrayBuffer]));
    const width = Math.min(480, bitmap.width);
    const height = Math.round(bitmap.height * (width / bitmap.width));
    bitmap.close();
    return new ImageRun({ data, type: "png", transformation: { width, height } });
  } catch {
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 把 SVG（mermaid 等）栅格化成 PNG dataURL，方便嵌入 docx */
async function svgToImage(svg: SVGSVGElement): Promise<ImageRun | null> {
  try {
    const w = svg.clientWidth || Number(svg.getAttribute("width")) || 400;
    const h = svg.clientHeight || Number(svg.getAttribute("height")) || 300;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = base64ToBytes(canvas.toDataURL("image/png").split(",")[1]);
    return new ImageRun({ data, type: "png", transformation: { width: Math.min(480, w), height: Math.round(h * (Math.min(480, w) / w)) } });
  } catch {
    return null;
  }
}

/* ── 块级转换 ── */

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

function alignmentOf(el: Element): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const t = getComputedStyle(el).textAlign;
  if (t === "center") return AlignmentType.CENTER;
  if (t === "right" || t === "end") return AlignmentType.RIGHT;
  if (t === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function shadingOf(el: Element): { fill: string } | undefined {
  const cs = getComputedStyle(el);
  if (cs.backgroundColor === "rgba(0, 0, 0, 0)") return undefined;
  const hex = cssColorToHex(cs.backgroundColor);
  return hex ? { fill: hex } : undefined;
}

function indentOf(el: Element): { left: number } | undefined {
  const ml = parseInt(getComputedStyle(el).marginLeft, 10);
  const pl = parseInt(getComputedStyle(el).paddingLeft, 10);
  const total = (Number.isNaN(ml) ? 0 : ml) + (Number.isNaN(pl) ? 0 : pl);
  return total > 4 ? { left: Math.round(total * 0.75 * 20) } : undefined; // px → twips
}

function isTaskItem(li: Element): boolean {
  return li.querySelector('input[type="checkbox"]') !== null;
}

async function listParagraphs(list: Element, ordered: boolean, depth: number): Promise<Paragraph[]> {
  const out: Paragraph[] = [];
  for (const li of Array.from(list.children).filter((c) => c.tagName.toLowerCase() === "li")) {
    const children = collectRuns(li);
    if (isTaskItem(li)) {
      const checked = li.getAttribute("data-checked") === "true";
      children.unshift(new TextRun({ text: checked ? "☑ " : "☐ ", font: FONT_FALLBACK }));
    }
    out.push(
      new Paragraph({
        children,
        // 无序/有序列表统一走自定义编号：WPS 对 docx 默认 bullet（Symbol 字体）
        // 会渲染成方块，用文本 "•" 编号保证跨软件显示一致
        numbering: { reference: ordered ? "tk-ol" : "tk-ul", level: Math.min(depth, 2) },
        spacing: { after: 60 },
      }),
    );
    for (const nested of Array.from(li.children)) {
      const t = nested.tagName.toLowerCase();
      if (t === "ul" || t === "ol") out.push(...(await listParagraphs(nested, t === "ol", depth + 1)));
    }
  }
  return out;
}

/** 代码块 → 每行一个等宽字体段落（浅灰底 + 细边框） */
function codeParagraphs(codeEl: Element): (Paragraph | Table)[] {
  const codeBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" as const },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" as const },
    left: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" as const },
    right: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" as const },
  };
  const lines = (codeEl.textContent ?? "").replace(/\n$/, "").split("\n");
  return lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || " ", font: FONT_MONO, color: "24292F", size: 20 })],
        shading: { fill: "F6F8FA" },
        border: codeBorder,
        indent: { left: 120, right: 120 },
        spacing: { after: 0 },
      }),
  );
}

async function convertBlock(el: Element): Promise<(Paragraph | Table)[]> {
  const tag = el.tagName.toLowerCase();
  const align = alignmentOf(el);
  const shading = shadingOf(el);

  if (/^h[1-6]$/.test(tag)) {
    return [new Paragraph({ children: collectRuns(el), heading: HEADING_LEVELS[Number(tag[1]) - 1], alignment: align, spacing: { before: 240, after: 120 } })];
  }

  if (tag === "p" || tag === "div") {
    // 代码块是自定义 node-view：<div class="tk-code-block">…<pre><code>…</code></pre></div>
    const codeEl = el.querySelector("code");
    if (el.querySelector("pre") && codeEl) return codeParagraphs(codeEl);
    // Tiptap 的表格会被 <div class="tableWrapper"> 包裹；div 内含列表/表格时递归处理
    if (tag === "div") {
      const nested = Array.from(el.children).filter((c) =>
        ["table", "ul", "ol"].includes(c.tagName.toLowerCase()),
      );
      if (nested.length > 0) {
        const out: (Paragraph | Table)[] = [];
        for (const child of nested) out.push(...(await convertBlock(child)));
        return out;
      }
    }
    const children = collectRuns(el);
    if (children.length === 0) return [new Paragraph({ children: [] })];
    return [new Paragraph({ children, alignment: align, shading, indent: tag === "div" ? indentOf(el) : undefined, spacing: { after: 120 } })];
  }

  if (tag === "ul" || tag === "ol") return listParagraphs(el, tag === "ol", 0);

  if (tag === "blockquote") {
    const borderColor = cssColorToHex(getComputedStyle(el).borderLeftColor) ?? "CCCCCC";
    return [
      new Paragraph({
        children: collectRuns(el),
        indent: { left: 480 },
        alignment: align,
        spacing: { after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: borderColor, space: 12 } },
      }),
    ];
  }

  if (tag === "pre") {
    const codeEl = el.querySelector("code") ?? el;
    return codeParagraphs(codeEl);
  }

  if (tag === "hr") {
    return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 } } })];
  }

  if (tag === "table") {
    // A4 内容区宽度（去掉默认页边距）约 9026 twips，列宽按 DOM 实际占比分配
    const CONTENT_TWIPS = 9026;
    const firstRow = el.querySelector("tr");
    const colCount = firstRow ? firstRow.children.length : 1;
    const domWidths = firstRow
      ? Array.from(firstRow.children).map((c) => (c as HTMLElement).offsetWidth || 1)
      : [1];
    const domTotal = domWidths.reduce((a, b) => a + b, 0);
    const colWidths = domWidths.map((w) => Math.round((w / domTotal) * CONTENT_TWIPS));
    const rows = await Promise.all(
      Array.from(el.querySelectorAll("tr")).map(async (tr) => {
        const cells = await Promise.all(
          Array.from(tr.children).map(async (cell, i) => {
            const children = [...collectRuns(cell)];
            const isHeader = cell.tagName.toLowerCase() === "th";
            return new TableCell({
              children: [new Paragraph({ children })],
              width: { size: colWidths[i] ?? CONTENT_TWIPS / colCount, type: WidthType.DXA },
              shading: isHeader ? { fill: "F2F2F2" } : undefined,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
              },
            });
          }),
        );
        return new TableRow({ children: cells });
      }),
    );
    return [
      new Table({
        rows,
        width: { size: CONTENT_TWIPS, type: WidthType.DXA },
        columnWidths: colWidths,
        layout: TableLayoutType.FIXED,
      }),
    ];
  }

  // 图片块 / 内联图
  if (tag === "img") {
    const run = await imageToRun(el as HTMLImageElement);
    return run ? [new Paragraph({ children: [run], alignment: align })] : [];
  }

  return [new Paragraph({ children: collectRuns(el), alignment: align, shading })];
}

/** 编辑器 DOM → docx Document（读真实计算样式） */
export async function buildDocx(root: HTMLElement): Promise<Document> {
  const children: (Paragraph | Table)[] = [];

  for (const node of Array.from(root.children)) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // mermaid 等 SVG 块栅格化为图片
    if (tag === "svg" || el.querySelector(":scope > svg")) {
      const svg = (tag === "svg" ? el : el.querySelector(":scope > svg")) as SVGSVGElement | null;
      if (svg) {
        const run = await svgToImage(svg);
        if (run) {
          children.push(new Paragraph({ children: [run] }));
          continue;
        }
      }
    }

    // 图片块容器
    const img = tag === "p" ? null : el.querySelector(":scope > img");
    if (img) {
      const run = await imageToRun(img as HTMLImageElement);
      if (run) {
        children.push(new Paragraph({ children: [run] }));
        continue;
      }
    }

    children.push(...(await convertBlock(el)));
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: "tk-ol",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT },
            { level: 1, format: "decimal", text: "%2.", alignment: AlignmentType.LEFT },
            { level: 2, format: "decimal", text: "%3.", alignment: AlignmentType.LEFT },
          ],
        },
        {
          // 用文本 "•" 编号代替 docx 默认 bullet（Symbol 字体），避免 WPS 渲染成方块
          reference: "tk-ul",
          levels: [
            { level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT },
            { level: 1, format: "bullet", text: "◦", alignment: AlignmentType.LEFT },
            { level: 2, format: "bullet", text: "▪", alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
}

export { Packer };
