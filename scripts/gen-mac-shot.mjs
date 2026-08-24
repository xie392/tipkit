import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotDir = join(__dirname, "../apps/demo/public/screenshots");

const TITLE_BAR_H = 36;
const RADIUS = 12;
const PADDING = 1;
const DOT_R = 6;
const DOT_GAP = 10;
const DOT_LEFT = 14;
const DOT_Y = TITLE_BAR_H / 2;

function roundedRectPath(w, h, r) {
  return Buffer.from(
    `<svg><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`
  );
}

async function macFrame(inputPath, outputPath) {
  const { width: imgW, height: imgH } = await sharp(inputPath).metadata();
  const totalW = imgW + PADDING * 2;
  const totalH = imgH + TITLE_BAR_H + PADDING * 2;

  const titleBarSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="round">
          <rect x="0" y="0" width="${totalW}" height="${totalH}" rx="${RADIUS}" ry="${RADIUS}"/>
        </clipPath>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e8e8ea"/>
          <stop offset="100%" stop-color="#d8d8dc"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#round)">
        <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="url(#bar)"/>
        <rect x="0" y="${TITLE_BAR_H}" width="${totalW}" height="${totalH - TITLE_BAR_H}" fill="#ffffff"/>
      </g>
      <circle cx="${DOT_LEFT}" cy="${DOT_Y}" r="${DOT_R}" fill="#ff5f57"/>
      <circle cx="${DOT_LEFT + DOT_R * 2 + DOT_GAP}" cy="${DOT_Y}" r="${DOT_R}" fill="#febc2e"/>
      <circle cx="${DOT_LEFT + (DOT_R * 2 + DOT_GAP) * 2}" cy="${DOT_Y}" r="${DOT_R}" fill="#28c840"/>
      <rect x="0" y="${TITLE_BAR_H - 0.5}" width="${totalW}" height="1" fill="#00000018"/>
    </svg>
  `;

  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: Buffer.from(titleBarSvg), top: 0, left: 0 },
      { input: inputPath, top: TITLE_BAR_H + PADDING, left: PADDING },
    ])
    .png()
    .toFile(outputPath);

  console.log("generated:", outputPath, totalW + "x" + totalH);
}

const tasks = [
  ["homepage-viewport.png", "homepage-mac.png"],
  ["demo-viewport.png", "demo-mac.png"],
];

for (const [src, out] of tasks) {
  await macFrame(join(shotDir, src), join(shotDir, out));
}
