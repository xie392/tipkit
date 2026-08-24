import sharp from "sharp";
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

const SHADOW_MARGIN = 56;
const SHADOW_DY = 20;
const SHADOW_BLUR = 36;
const SHADOW_OPACITY = 0.26;

async function macFrame(inputPath, outputPath) {
  const { width: imgW, height: imgH } = await sharp(inputPath).metadata();
  const winW = imgW + PADDING * 2;
  const winH = imgH + TITLE_BAR_H + PADDING * 2;

  const titleBarSvg = `
    <svg width="${winW}" height="${winH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="round">
          <rect x="0" y="0" width="${winW}" height="${winH}" rx="${RADIUS}" ry="${RADIUS}"/>
        </clipPath>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ececef"/>
          <stop offset="100%" stop-color="#d9d9de"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#round)">
        <rect x="0" y="0" width="${winW}" height="${winH}" fill="url(#bar)"/>
        <rect x="0" y="${TITLE_BAR_H}" width="${winW}" height="${winH - TITLE_BAR_H}" fill="#ffffff"/>
      </g>
      <circle cx="${DOT_LEFT}" cy="${DOT_Y}" r="${DOT_R}" fill="#ff5f57"/>
      <circle cx="${DOT_LEFT + DOT_R * 2 + DOT_GAP}" cy="${DOT_Y}" r="${DOT_R}" fill="#febc2e"/>
      <circle cx="${DOT_LEFT + (DOT_R * 2 + DOT_GAP) * 2}" cy="${DOT_Y}" r="${DOT_R}" fill="#28c840"/>
      <rect x="0" y="${TITLE_BAR_H - 0.5}" width="${winW}" height="1" fill="#00000014"/>
      <rect x="0.5" y="0.5" width="${winW - 1}" height="${winH - 1}" rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="#00000010" stroke-width="1"/>
    </svg>
  `;

  const windowBuffer = await sharp({
    create: {
      width: winW,
      height: winH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: Buffer.from(titleBarSvg), top: 0, left: 0 },
      { input: inputPath, top: TITLE_BAR_H + PADDING, left: PADDING },
    ])
    .png()
    .toBuffer();

  const shadowBuffer = await sharp({
    create: {
      width: winW,
      height: winH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${winW}" height="${winH}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${winW}" height="${winH}" rx="${RADIUS}" ry="${RADIUS}" fill="#000000" fill-opacity="${SHADOW_OPACITY}"/>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .blur(SHADOW_BLUR)
    .png()
    .toBuffer();

  const outW = winW + SHADOW_MARGIN * 2;
  const outH = winH + SHADOW_MARGIN * 2;

  await sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowBuffer, top: SHADOW_MARGIN + SHADOW_DY, left: SHADOW_MARGIN },
      { input: windowBuffer, top: SHADOW_MARGIN, left: SHADOW_MARGIN },
    ])
    .png()
    .toFile(outputPath);

  console.log("generated:", outputPath, outW + "x" + outH);
}

const tasks = [
  ["homepage-viewport.png", "homepage-mac.png"],
  ["demo-viewport.png", "demo-mac.png"],
];

for (const [src, out] of tasks) {
  await macFrame(join(shotDir, src), join(shotDir, out));
}
