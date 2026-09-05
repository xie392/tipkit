// mammoth 未自带类型声明；demo 仅用浏览器端构建的 convertToHtml
declare module "mammoth/mammoth.browser" {
  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: Record<string, unknown>,
  ): Promise<MammothResult>;
}
