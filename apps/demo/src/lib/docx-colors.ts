/* CSS 计算值颜色（lab / oklch / color(srgb) / rgb / hex）→ docx 需要的 RRGGBB hex。
 * 主题层使用 lab()/oklch()，docx 只认 sRGB hex，导出前在此统一换算。 */

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
  const zr = fz ** 3 > epsilon ? fz ** 3 : (116 * fx - 16) / kappa;
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
