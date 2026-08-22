import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { TipKitEditor } from "./tiptap-editor";

/**
 * 客户端渲染集成测试：验证 TipKitEditor 渲染出可编辑的 ProseMirror。
 * 回归保护：demo 曾出现"页面可打开但无法编辑"。
 */
describe("TipKitEditor 客户端渲染", () => {
  it("渲染出 contentEditable 的编辑区", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TipKitEditor deps={{}} content="<p>你好</p>" placeholder="写下点什么…" />,
      );
    });

    const pm = container.querySelector(".ProseMirror");
    expect(pm).toBeTruthy();
    expect(pm?.getAttribute("contenteditable")).toBe("true");
    expect(pm?.textContent).toContain("你好");

    root.unmount();
    container.remove();
  });

  it("children 函数可拿到 editor 实例", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let seen: unknown = null;

    act(() => {
      root.render(
        <TipKitEditor deps={{}}>
          {(editor) => {
            seen = editor;
            return null;
          }}
        </TipKitEditor>,
      );
    });

    expect(seen).toBeTruthy();
    root.unmount();
    container.remove();
  });
});
