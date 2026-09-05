import { ImageRun } from "docx";

/* 图片 / SVG / Canvas → docx ImageRun */

/** 把画布/图像绘制到中间 canvas 并返回 PNG 字节 */
function drawToPngBytes(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
): Uint8Array | null {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  draw(ctx, w, h);
  return base64ToBytes(canvas.toDataURL("image/png").split(",")[1]);
}

/** 通过 Image 元素加载 src（data:/http: 均可） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function fitSize(w: number, h: number, max = 480): { width: number; height: number } {
  const width = Math.min(max, w);
  return { width, height: Math.round(h * (width / w)) };
}

export async function imageToRun(img: HTMLImageElement): Promise<ImageRun | null> {
  const src = img.getAttribute("src");
  if (!src) return null;
  try {
    // SVG（含 data:image/svg+xml）：浏览器位图接口不支持，先经 Image+canvas 转成 PNG
    const isSvg = /svg/i.test(src) || /\.svg(\?|$)/i.test(src);
    if (isSvg) {
      const img2 = await loadImage(src);
      const w0 = img2.naturalWidth || img2.clientWidth || 480;
      const h0 = img2.naturalHeight || img2.clientHeight || Math.round(w0 * 0.6);
      const data = await drawToPngBytes(
        (ctx) => ctx.drawImage(img2, 0, 0, w0, h0),
        w0 * 2,
        h0 * 2,
      );
      if (!data) return null;
      return new ImageRun({ data, type: "png", transformation: fitSize(w0, h0) });
    }
    let data: Uint8Array;
    if (src.startsWith("data:")) {
      data = base64ToBytes(src.slice(src.indexOf(",") + 1));
    } else {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) return null;
      data = new Uint8Array(await res.arrayBuffer());
    }
    const bitmap = await createImageBitmap(new Blob([data.buffer as ArrayBuffer]));
    const size = fitSize(bitmap.width, bitmap.height);
    bitmap.close();
    return new ImageRun({ data, type: "png", transformation: size });
  } catch {
    return null;
  }
}

/** 画板（canvas）→ PNG 图片 */
export async function canvasToRun(c: HTMLCanvasElement): Promise<ImageRun | null> {
  try {
    const dataUrl = c.toDataURL("image/png");
    const data = base64ToBytes(dataUrl.split(",")[1]);
    const bitmap = await createImageBitmap(new Blob([data.buffer as ArrayBuffer]));
    const size = fitSize(bitmap.width, bitmap.height);
    bitmap.close();
    return new ImageRun({ data, type: "png", transformation: size });
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

/** 把 SVG（mermaid 等）栅格化成 PNG 嵌入 docx */
export async function svgToImage(svg: SVGSVGElement): Promise<ImageRun | null> {
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
    return new ImageRun({ data, type: "png", transformation: fitSize(w, h) });
  } catch {
    return null;
  }
}
