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

  const upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Upstream error (${upstream.status}): ${errText.slice(0, 300)}` },
      { status: upstream.status },
    );
  }

  // 透传 SSE 流：Content-Type 必须是 text/event-stream，不能让 Next.js 缓冲
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      controller.enqueue(chunk);
    },
  });

  upstream.body.pipeTo(transformStream.writable);

  return new NextResponse(transformStream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
