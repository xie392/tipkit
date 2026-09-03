import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? process.env.NEXT_PUBLIC_DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

export async function POST(req: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  const { prompt, selection } = (await req.json()) as { prompt?: string; selection?: string };
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const userContent = selection
    ? `以下是选中的文本，请根据指令处理：\n\n"""${selection}"""\n\n指令：${prompt}`
    : prompt;

  // 控制器：客户端断开或服务端出错时 abort 上游请求
  const controller = new AbortController();
  const abortOnDisconnect = () => controller.abort();
  req.signal.addEventListener("abort", abortOnDisconnect);

  let upstream: Response;
  try {
    upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        stream: true,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的写作助手，帮助用户进行文本的续写、改写、润色、翻译、总结等任务。直接输出处理后的文本内容，不要添加任何解释、前言或后记，不要使用 markdown 代码块包裹。",
          },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    req.signal.removeEventListener("abort", abortOnDisconnect);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upstream fetch failed: ${msg}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    req.signal.removeEventListener("abort", abortOnDisconnect);
    return NextResponse.json(
      { error: `Upstream error (${upstream.status}): ${errText.slice(0, 300)}` },
      { status: upstream.status },
    );
  }

  // 逐行透传 SSE：遇到 data: [DONE] 后主动关闭 writer，避免连接悬挂
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (sawDone) break;
        buffer += decoder.decode(value, { stream: true });
        // 按行扫描，检查是否出现 [DONE]
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              sawDone = true;
              break;
            }
          }
        }
        await writer.write(value);
        if (sawDone) break;
      }
    } catch {
      /* 客户端断开或上游错误，忽略 */
    } finally {
      try {
        await writer.close();
      } catch {
        /* ignore */
      }
      reader.releaseLock();
      req.signal.removeEventListener("abort", abortOnDisconnect);
    }
  })();

  // 不使用 upstream.body.pipeTo()（Next.js 下可能不主动关闭导致悬挂）
  // 显式返回我们自己完全控制的 readable
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
