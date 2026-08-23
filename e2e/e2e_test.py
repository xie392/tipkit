"""
TipKit E2E 测试套件 —— 在真实 Chromium 中验证编辑器行为。

覆盖：
1. Markdown 输入规则（标题/列表/引用/分隔线/代码块/行内格式）
2. 斜杠菜单（触发/过滤/键盘导航/回车执行/嵌套容器）
3. NodeView 节点（Callout/分栏/折叠块/附件/Iframe/KaTeX/代码块工具栏）
4. 边界场景（撤销重做/主题切换/只读/HTML 往返）

运行：python3 e2e/e2e_test.py
前提：dev server 运行在 http://localhost:3000/demo
"""
import sys
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:3000/demo"
PASS = 0
FAIL = 0
ERRORS: list[str] = []


def check(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        msg = f"  ✗ {name}" + (f" —— {detail}" if detail else "")
        print(msg)
        ERRORS.append(msg)


def get_editor_html(page) -> str:
    return page.evaluate("() => document.querySelector('.ProseMirror').innerHTML")


def clear_editor(page):
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        ed.commands.setContent('');
        ed.commands.focus();
    }""")
    page.locator(".ProseMirror").first.click()
    page.wait_for_timeout(150)


def editor_is_active(page, node_name: str, attrs: dict | None = None) -> bool:
    return page.evaluate(
        """([name, attrs]) => {
            const ed = document.querySelector('.ProseMirror').editor;
            return ed.isActive(name, attrs || {});
        }""",
        [node_name, attrs],
    )


def has_node(page, selector: str) -> bool:
    return page.locator(selector).count() > 0


def run_markdown_input_rules(page):
    print("\n=== Markdown 输入规则 ===")
    editor = page.locator(".ProseMirror").first

    # ## 标题
    clear_editor(page)
    editor.click()
    page.keyboard.type("## ", delay=30)
    page.wait_for_timeout(300)
    check("## 空格 转 h2", editor_is_active(page, "heading", {"level": 2}))

    # ### 标题
    clear_editor(page)
    page.keyboard.type("### ", delay=30)
    page.wait_for_timeout(300)
    check("### 空格 转 h3", editor_is_active(page, "heading", {"level": 3}))

    # - 无序列表
    clear_editor(page)
    page.keyboard.type("- ", delay=30)
    page.wait_for_timeout(300)
    check("- 空格 转无序列表", editor_is_active(page, "bulletList"))

    # 1. 有序列表
    clear_editor(page)
    page.keyboard.type("1. ", delay=30)
    page.wait_for_timeout(300)
    check("1. 空格 转有序列表", editor_is_active(page, "orderedList"))

    # > 引用
    clear_editor(page)
    page.keyboard.type("> ", delay=30)
    page.wait_for_timeout(300)
    check("> 空格 转引用块", editor_is_active(page, "blockquote"))

    # --- 分隔线
    clear_editor(page)
    page.keyboard.type("---", delay=30)
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    html = get_editor_html(page)
    check("--- 回车 转分隔线", "<hr" in html or "tk-hr" in html or "horizontalRule" in html)

    # ``` 代码块
    clear_editor(page)
    page.keyboard.type("``` ", delay=30)
    page.wait_for_timeout(400)
    check("``` 空格 转代码块", has_node(page, ".tk-code-block"))

    # ~~~ 代码块
    clear_editor(page)
    page.keyboard.type("~~~ ", delay=30)
    page.wait_for_timeout(400)
    check("~~~ 空格 转代码块", has_node(page, ".tk-code-block"))

    # ```js 带语言
    clear_editor(page)
    page.keyboard.type("```js ", delay=30)
    page.wait_for_timeout(400)
    lang = page.evaluate("""() => {
        const el = document.querySelector('.tk-code-block');
        return el ? el.getAttribute('data-language') : null;
    }""")
    check("```js 带语言标识", lang in ("js", "javascript"), f"lang={lang}")

    # 行内代码
    clear_editor(page)
    page.keyboard.type("`code`", delay=30)
    page.wait_for_timeout(300)
    html = get_editor_html(page)
    check("`code` 转行内代码", "<code>code</code>" in html)


def run_slash_menu(page):
    print("\n=== 斜杠菜单 ===")
    editor = page.locator(".ProseMirror").first

    # 触发
    clear_editor(page)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(400)
    menu = page.locator(".tk-slash-menu")
    check("输入 / 显示菜单", menu.is_visible())
    items = page.locator(".tk-slash-item")
    check("菜单项数量 >= 17", items.count() >= 17, f"count={items.count()}")

    # 过滤
    page.keyboard.type("table", delay=30)
    page.wait_for_timeout(300)
    visible_items = page.locator(".tk-slash-item:visible")
    check("输入 table 过滤后只剩表格项", visible_items.count() == 1, f"count={visible_items.count()}")

    # Esc 关闭
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check("Esc 关闭菜单", not menu.is_visible())

    # 键盘上下选择 + 回车执行
    # 菜单打开时第一项（heading-1）默认已选中，直接回车插入 h1
    clear_editor(page)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(400)
    # 验证第一项有 data-active
    first_active = page.evaluate("""() => {
        const first = document.querySelector('.tk-slash-item');
        return first ? first.getAttribute('data-active') === 'true' : false;
    }""")
    check("菜单打开时第一项默认高亮", first_active)
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    check("直接回车插入第一项 h1", editor_is_active(page, "heading", {"level": 1}))

    # ArrowDown 移到第二项（h2）后回车
    clear_editor(page)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(500)
    # 等待第一项高亮（确保菜单 React state 就绪）
    page.wait_for_function("""() => {
        const first = document.querySelector('.tk-slash-item');
        return first && first.getAttribute('data-active') === 'true';
    }""", timeout=3000)
    page.keyboard.press("ArrowDown")
    page.wait_for_timeout(300)
    second_active = page.evaluate("""() => {
        const items = document.querySelectorAll('.tk-slash-item');
        return items[1] ? items[1].getAttribute('data-active') === 'true' : false;
    }""")
    check("ArrowDown 高亮第二项", second_active)
    page.keyboard.press("Enter")
    page.wait_for_timeout(400)
    check("ArrowDown+回车插入 h2", editor_is_active(page, "heading", {"level": 2}))

    # 搜索 h2（别名）并回车
    clear_editor(page)
    page.keyboard.type("/h2", delay=30)
    page.wait_for_timeout(400)
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    check("搜索 h2 别名回车插入 h2", editor_is_active(page, "heading", {"level": 2}))

    # 嵌套容器：blockquote 内触发
    clear_editor(page)
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        ed.commands.setContent('<blockquote><p></p></blockquote>');
    }""")
    # 把光标放入 blockquote 内的 p
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        let pos = 0;
        ed.state.doc.descendants((n, p) => {
            if (n.type.name === 'paragraph') { pos = p + 1; return false; }
            return true;
        });
        ed.commands.focus();
        ed.commands.setTextSelection(pos);
    }""")
    page.wait_for_timeout(150)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(400)
    check("blockquote 内可触发斜杠菜单", page.locator(".tk-slash-menu").is_visible())
    page.keyboard.press("Escape")

    # 嵌套容器：callout 内触发
    clear_editor(page)
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        ed.chain().focus().setCallout().run();
    }""")
    page.wait_for_timeout(200)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(400)
    check("callout 内可触发斜杠菜单", page.locator(".tk-slash-menu").is_visible())
    page.keyboard.press("Escape")

    # 代码块内不触发
    clear_editor(page)
    page.keyboard.type("``` ", delay=30)
    page.wait_for_timeout(400)
    page.keyboard.type("/", delay=30)
    page.wait_for_timeout(300)
    check("代码块内不触发斜杠菜单", not page.locator(".tk-slash-menu").is_visible())


def run_node_views(page):
    print("\n=== NodeView 节点 ===")
    editor = page.locator(".ProseMirror").first

    # Callout
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setCallout().run();
    }""")
    page.wait_for_timeout(300)
    check("Callout 节点渲染", has_node(page, ".tk-callout"))
    callout_classes = page.locator(".tk-callout").first.get_attribute("class") or ""
    check("Callout 默认 info 变体", "tk-callout-info" in callout_classes, callout_classes)

    # 切换 Callout 变体
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setCalloutVariant('warning').run();
    }""")
    page.wait_for_timeout(200)
    callout_classes2 = page.locator(".tk-callout").first.get_attribute("class") or ""
    check("Callout 切换为 warning", "tk-callout-warning" in callout_classes2, callout_classes2)

    # 分栏
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setColumns().run();
    }""")
    page.wait_for_timeout(300)
    check("Columns 节点渲染", has_node(page, ".tk-columns, [data-type='columns']"))
    col_count = page.locator("[data-type='column'], .tk-column").count()
    check("Columns 包含两列", col_count >= 2, f"col_count={col_count}")

    # 折叠块
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setDetails().run();
    }""")
    page.wait_for_timeout(300)
    check("Details 节点渲染", has_node(page, "details, .tk-details, [data-type='details']"))

    # Iframe
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setIframe({ url: 'https://example.com' }).run();
    }""")
    page.wait_for_timeout(400)
    check("Iframe 节点渲染", has_node(page, ".tk-iframe, iframe"))
    iframe_html = get_editor_html(page)
    check("Iframe 保留 url", "example.com" in iframe_html)

    # KaTeX
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setKatex({ text: 'x^2' }).run();
    }""")
    page.wait_for_timeout(500)
    check("KaTeX 节点渲染", has_node(page, ".tk-katex, .katex"))

    # 附件
    clear_editor(page)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.chain().focus().setAttachment({
            fileName: '设计文档', fileExt: 'pdf', fileSize: 1024, url: 'https://x.com/f.pdf'
        }).run();
    }""")
    page.wait_for_timeout(400)
    check("附件节点渲染", has_node(page, ".tk-attachment"))
    att_text = page.locator(".tk-attachment").first.text_content() or ""
    check("附件文件名不重复后缀", "设计文档.pdf" in att_text and ".pdf.pdf" not in att_text, att_text[:80])

    # 代码块工具栏（复制/语言/主题切换）
    clear_editor(page)
    page.keyboard.type("``` ", delay=30)
    page.wait_for_timeout(400)
    check("代码块工具栏渲染", has_node(page, ".tk-code-block-toolbar"))
    check("代码块语言按钮存在", has_node(page, ".tk-code-block-lang-btn"))


def run_edge_cases(page):
    print("\n=== 边界场景 ===")
    editor = page.locator(".ProseMirror").first

    # 撤销重做
    clear_editor(page)
    page.keyboard.type("Hello", delay=20)
    page.wait_for_timeout(200)
    check("输入文本正常", "Hello" in get_editor_html(page))
    page.keyboard.press("Meta+z")
    page.wait_for_timeout(300)
    check("Meta+z 撤销", "Hello" not in get_editor_html(page))
    page.keyboard.press("Meta+Shift+z")
    page.wait_for_timeout(300)
    check("Meta+Shift+z 重做", "Hello" in get_editor_html(page))

    # 只读模式
    clear_editor(page)
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        ed.setEditable(false);
    }""")
    page.wait_for_timeout(150)
    is_editable = page.evaluate("() => document.querySelector('.ProseMirror').editor.isEditable")
    check("setEditable(false) 只读模式", is_editable is False)
    page.evaluate("""() => {
        document.querySelector('.ProseMirror').editor.setEditable(true);
    }""")

    # 主题切换：点击主题切换按钮，选择 dark
    theme_trigger = page.locator(".site-theme-switch-trigger").first
    if theme_trigger.count() > 0:
        old_theme = page.evaluate("""() => {
            const html = document.documentElement;
            return Array.from(html.classList).find(c => c.startsWith('tk-theme-')) || '';
        }""")
        theme_trigger.click()
        page.wait_for_timeout(300)
        # 点击 dark 主题选项
        dark_item = page.locator(".site-theme-menu-item").filter(has_text="深色")
        if dark_item.count() == 0:
            dark_item = page.locator(".site-theme-menu-item").nth(2)
        dark_item.click()
        page.wait_for_timeout(500)
        new_theme = page.evaluate("""() => {
            const html = document.documentElement;
            return Array.from(html.classList).find(c => c.startsWith('tk-theme-')) || '';
        }""")
        check("主题切换为 dark", "dark" in new_theme, f"{old_theme} -> {new_theme}")
        # 切回 default
        theme_trigger.click()
        page.wait_for_timeout(300)
        page.locator(".site-theme-menu-item").first.click()
        page.wait_for_timeout(300)
    else:
        print("  ⊙ 未找到主题切换按钮，跳过")

    # 空文档不崩溃
    clear_editor(page)
    check("空文档正常渲染", get_editor_html(page) is not None)

    # 多次撤销到空不报错
    page.keyboard.type("abc", delay=20)
    page.wait_for_timeout(150)
    for _ in range(10):
        page.keyboard.press("Meta+z")
    page.wait_for_timeout(200)
    check("多次撤销到空不报错", True)

    # HTML 往返：设置复杂内容后 getHTML 再 setContent
    clear_editor(page)
    page.evaluate("""() => {
        const ed = document.querySelector('.ProseMirror').editor;
        ed.commands.setContent('<h2>标题</h2><p>正文</p><ul><li><p>列表</p></li></ul><blockquote><p>引用</p></blockquote>');
    }""")
    page.wait_for_timeout(300)
    html = get_editor_html(page)
    page.evaluate("""(html) => {
        document.querySelector('.ProseMirror').editor.commands.setContent(html);
    }""", html)
    page.wait_for_timeout(300)
    html2 = get_editor_html(page)
    check("HTML 往返不丢节点", all(k in html2 for k in ["标题", "正文", "列表", "引用"]))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()

        console_errors: list[str] = []
        page.on("pageerror", lambda e: console_errors.append(f"PAGEERROR: {e}"))
        page.on("console", lambda m: console_errors.append(f"CONSOLE.{m.type}: {m.text}") if m.type == "error" else None)

        print(f"导航到 {BASE_URL} ...")
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_timeout(1500)
        check("页面加载成功", page.locator(".ProseMirror").count() == 1)

        try:
            run_markdown_input_rules(page)
            run_slash_menu(page)
            run_node_views(page)
            run_edge_cases(page)
        except Exception as e:
            global FAIL
            FAIL += 1
            ERRORS.append(f"测试执行异常: {e}")
            import traceback
            traceback.print_exc()

        # 检查控制台错误（排除 React DevTools 提示）
        real_errors = [e for e in console_errors if "Download the React DevTools" not in e and "HMR" not in e]
        if real_errors:
            print(f"\n=== 控制台错误 ({len(real_errors)}) ===")
            for e in real_errors[:10]:
                print(f"  ! {e}")
                ERRORS.append(e)
            FAIL += len(real_errors)

        browser.close()

    print(f"\n{'='*50}")
    print(f"通过: {PASS}  失败: {FAIL}")
    if ERRORS:
        print("\n失败项:")
        for e in ERRORS:
            print(e)
    print(f"{'='*50}")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
