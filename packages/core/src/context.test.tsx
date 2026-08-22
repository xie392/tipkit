import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { EditorProvider, useEditorDeps } from "./context";
import type { EditorDeps } from "./types";

/** 探针组件：把 context 值透传给断言 */
function Probe({ onDeps }: { onDeps: (deps: EditorDeps) => void }) {
  onDeps(useEditorDeps());
  return null;
}

describe("EditorProvider 依赖注入", () => {
  it("注入的 deps 可被 useEditorDeps 读取", () => {
    const deps: EditorDeps = {
      uploadImage: async () => "https://example.com/a.png",
      uploadAttachment: async () => ({
        url: "https://example.com/a.pdf",
        name: "a.pdf",
        size: 100,
        mimeType: "application/pdf",
      }),
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let received: EditorDeps | undefined;
    act(() => {
      root.render(
        <EditorProvider deps={deps}>
          <Probe onDeps={(d) => (received = d)} />
        </EditorProvider>,
      );
    });

    expect(received?.uploadImage).toBe(deps.uploadImage);
    expect(received?.uploadAttachment).toBe(deps.uploadAttachment);
  });

  it("未提供 Provider 时返回空对象（安全降级）", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let received: EditorDeps | undefined;
    act(() => {
      root.render(<Probe onDeps={(d) => (received = d)} />);
    });

    expect(received).toEqual({});
  });
});
