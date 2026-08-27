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

// 3. 复制 base.css（独立导出保留）
writeFileSync(resolve(distDir, "base.css"), readFileSync(resolve(srcDir, "base.css"), "utf-8"));

// 4. 处理各主题 CSS：保留 @import "./base.css"，不内联，避免被多次导入时重复规则覆盖
const themeFiles = ["default.css", "sketch.css", "dark.css"];

for (const file of themeFiles) {
  const themeSource = readFileSync(resolve(srcDir, file), "utf-8");
  writeFileSync(resolve(distDir, file), themeSource);
}
