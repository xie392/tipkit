import Link from "next/link";

/** 全站页脚：项目定位 + 快速链接 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-brand-mark" />
          <span className="site-footer-name">TipKit</span>
          <p className="site-footer-desc">
            基于 Tiptap v3 + shadcn/ui 的无头富文本编辑器套件
          </p>
        </div>
        <nav className="site-footer-links" aria-label="页脚导航">
          <Link href="/demo" target="_blank" rel="noopener noreferrer">在线演示</Link>
          <Link href="/docs">接入文档</Link>
        </nav>
        <p className="site-footer-copy">
          © {new Date().getFullYear()} TipKit · 一套逻辑，任意风格
        </p>
      </div>
    </footer>
  );
}
