import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");

// 1. 清理 dist
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 2. 复制 TS 源文件
cpSync(srcDir, distDir, {
  recursive: true,
  filter: (f) => {
    if (f === srcDir) return true;
    const stat = statSync(f);
    return stat.isDirectory() || !f.endsWith(".css");
  },
});

// 3. 读取 base.css
const baseCss = readFileSync(resolve(srcDir, "base.css"), "utf-8");

// 4. 将 base.css 写入 dist/base.css（独立导出保留）
writeFileSync(resolve(distDir, "base.css"), baseCss);

// 5. 处理各主题 CSS：内联 base.css，去除 @import 行
const themeFiles = ["default.css", "sketch.css", "dark.css"];

for (const file of themeFiles) {
  const themeSource = readFileSync(resolve(srcDir, file), "utf-8");

  const withoutImport = themeSource
    .replace(/^@import\s+["']\.\/base\.css["']\s*;?\s*\n?/, "")
    .trimStart();

  const combined = `${baseCss}\n\n${withoutImport}`;

  writeFileSync(resolve(distDir, file), combined);
}
