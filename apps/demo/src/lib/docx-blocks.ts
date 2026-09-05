import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { cssColorToHex } from "./docx-colors";
import { canvasToRun, imageToRun, svgToImage } from "./docx-media";
import { collectRuns, collectStyled, FONT_FALLBACK, FONT_MONO, mergeStyled, type TextStyle } from "./docx-runs";

/* 块级元素 → docx Paragraph/Table 的映射，以及最终的 buildDocx 入口 */

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

/** A4 内容区宽度（去掉默认页边距）约 9026 twips */
const CONTENT_TWIPS = 9026;

/** 代码块 → 单元格表格卡片（浅灰底 + 细边框 + 内边距）。
 * 逐行拆分但保留语法高亮 span 的计算颜色/等宽字体，不再压成单色文本。
 * 表格必须用 FIXED 布局 + DXA 全宽：WPS 对 pct 宽度的 auto 表格会塌缩到
 * 最小宽度，导致无空格的代码行逐字符换行（竖排一字一行） */
function codeParagraphs(codeEl: Element): (Paragraph | Table)[] {
  const styled = collectStyled(codeEl, true); // 保留缩进与原始空格
  const lines: TextStyle[][] = [[]];
  for (const r of styled) {
    const parts = r.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part.length) lines[lines.length - 1].push({ ...r, text: part });
    });
  }
  const paras = lines.map(
    (line) =>
      new Paragraph({
        children: line.length ? mergeStyled(line) : [new TextRun({ text: " ", font: FONT_MONO })],
        spacing: { after: 0 },
      }),
  );
  const border = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" as const };
  return [
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: paras,
              shading: { fill: "F6F8FA" },
              borders: { top: border, bottom: border, left: border, right: border },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              width: { size: CONTENT_TWIPS, type: WidthType.DXA },
            }),
          ],
        }),
      ],
      width: { size: CONTENT_TWIPS, type: WidthType.DXA },
      columnWidths: [CONTENT_TWIPS],
      layout: TableLayoutType.FIXED,
    }),
  ];
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };

/** 表格：按 DOM 实际列宽占比分配 A4 内容区 twips，支持 colspan/rowspan */
function tableElement(el: Element): Table[] {
  const rowsEls = Array.from(el.querySelectorAll("tr"));
  const firstRow = rowsEls[0];

  // 首行物理单元格宽度按 colspan 展开成逐列网格宽度
  const gridWidths: number[] = [];
  if (firstRow) {
    for (const c of Array.from(firstRow.children)) {
      const span = Number(c.getAttribute("colspan")) || 1;
      const w = ((c as HTMLElement).offsetWidth || 1) / span;
      for (let i = 0; i < span; i++) gridWidths.push(w);
    }
  }
  if (gridWidths.length === 0) gridWidths.push(1);
  const gridTotal = gridWidths.reduce((a, b) => a + b, 0);
  const colWidths = gridWidths.map((w) => Math.round((w / gridTotal) * CONTENT_TWIPS));

  // pendingSpans[c] = c 列还被上方 rowspan 单元格占用的剩余行数
  const pendingSpans: number[] = [];
  const rows = rowsEls.map((tr) => {
    let colIdx = 0;
    const cells = Array.from(tr.children).map((cell) => {
      while ((pendingSpans[colIdx] ?? 0) > 0) colIdx++;
      const colspan = Number(cell.getAttribute("colspan")) || 1;
      const rowspan = Number(cell.getAttribute("rowspan")) || 1;
      for (let i = 0; i < colspan; i++) pendingSpans[colIdx + i] = rowspan;
      const width =
        colWidths.slice(colIdx, colIdx + colspan).reduce((a, b) => a + b, 0) || CONTENT_TWIPS / colWidths.length;
      colIdx += colspan;
      const isHeader = cell.tagName.toLowerCase() === "th";
      return new TableCell({
        children: [new Paragraph({ children: collectRuns(cell) })],
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
        width: { size: width, type: WidthType.DXA },
        shading: isHeader ? { fill: "F2F2F2" } : undefined,
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
      });
    });
    for (let i = 0; i < pendingSpans.length; i++) if (pendingSpans[i] > 0) pendingSpans[i]--;
    return new TableRow({ children: cells });
  });

  return [
    new Table({
      rows,
      width: { size: CONTENT_TWIPS, type: WidthType.DXA },
      columnWidths: colWidths,
      layout: TableLayoutType.FIXED,
    }),
  ];
}

/** 嵌入内容（iframe / video）在 docx 里无法承载，输出虚线占位框说明 */
function mediaPlaceholder(label: string): Paragraph {
  const dash = { style: BorderStyle.DASHED, size: 4, color: "CCCCCC", space: 8 };
  return new Paragraph({
    children: [new TextRun({ text: label, color: "999999", italics: true, size: 20, font: FONT_FALLBACK })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    border: { top: dash, bottom: dash, left: dash, right: dash },
  });
}

async function convertBlock(el: Element): Promise<(Paragraph | Table)[]> {
  const tag = el.tagName.toLowerCase();
  const align = alignmentOf(el);
  const shading = shadingOf(el);

  // 嵌入 iframe / 视频的块：docx 无法承载，替换为占位框（否则导出为空白）
  const media = el.querySelector("iframe, video");
  if (media) {
    return [mediaPlaceholder(media.tagName.toLowerCase() === "video" ? "（视频，导出略）" : "（嵌入内容 iframe，导出略）")];
  }

  if (/^h[1-6]$/.test(tag)) {
    return [new Paragraph({ children: collectRuns(el), heading: HEADING_LEVELS[Number(tag[1]) - 1], alignment: align, spacing: { before: 240, after: 120 } })];
  }

  if (tag === "p" || tag === "div") {
    // Mermaid：整块替换为预览图（忽略隐藏的代码源文本）
    const mermaidSvg = el.querySelector(".tk-mermaid-preview svg") as SVGSVGElement | null;
    if (mermaidSvg) {
      const run = await svgToImage(mermaidSvg);
      if (run) return [new Paragraph({ children: [run], alignment: align })];
    }
    // 画板：canvas 栅格化为图片
    const canvas = el.querySelector("canvas");
    if (canvas) {
      const run = await canvasToRun(canvas as HTMLCanvasElement);
      if (run) return [new Paragraph({ children: [run], alignment: align })];
    }
    // 图片块/图片节点：转成 ImageRun
    const img = el.querySelector("img");
    if (img) {
      const run = await imageToRun(img as HTMLImageElement);
      if (run) return [new Paragraph({ children: [run], alignment: align })];
    }
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

  if (tag === "table") return tableElement(el);

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
