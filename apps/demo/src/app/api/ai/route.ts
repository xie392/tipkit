import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? process.env.NEXT_PUBLIC_DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

/** 每日费用上限（元）：默认 1 元，可通过环境变量 DEEPSEEK_DAILY_BUDGET 调整 */
const DAILY_BUDGET = Number(process.env.DEEPSEEK_DAILY_BUDGET ?? "1");
/** V4 Flash 单价（元 / 1M tokens） */
const PRICE_PER_MTOK = { input: 1, output: 2 };
/** 粗略 token 估算：中文 1 字 ≈ 1.5 token，英文 1 词 ≈ 1.3 token；这里取中文字符数 * 1.5 */
function estimateTokens(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const other = text.length - cn;
  return Math.ceil(cn * 1.5 + other * 0.4);
}

/** 内存级每日用量（Vercel Serverless：冷启动后重置，但对 demo 够用；
 *  对严格限额请在 DeepSeek 控制台设置 API key 配额） */
const usage = {
  dateKey: new Date().toISOString().slice(0, 10),
  inputTokens: 0,
  outputTokens: 0,
};
function todayUsage() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.dateKey !== today) {
    usage.dateKey = today;
    usage.inputTokens = 0;
    usage.outputTokens = 0;
  }
  return usage;
}
function costYuan(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * PRICE_PER_MTOK.input + (outputTokens / 1_000_000) * PRICE_PER_MTOK.output;
}

/** GET /api/ai：查询当日用量 */
export async function GET() {
  const u = todayUsage();
  return NextResponse.json({
    date: u.dateKey,
    budget: DAILY_BUDGET,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    costYuan: +costYuan(u.inputTokens, u.outputTokens).toFixed(4),
    remainingYuan: +Math.max(0, DAILY_BUDGET - costYuan(u.inputTokens, u.outputTokens)).toFixed(4),
  });
}

export async function POST(req: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY not configured on server" }, { status: 500 });
  }

  const { prompt, selection } = (await req.json()) as { prompt?: string; selection?: string };
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const userContent = selection
    ? `以下是选中的文本，请根据指令处理：\n\n"""${selection}"""\n\n指令：${prompt}`
    : prompt;

  // 预估本次输入 tokens，超预算直接拒绝
  const systemPrompt =
    "你是一个专业的写作助手，帮助用户进行文本的续写、改写、润色、翻译、总结等任务。直接输出处理后的文本内容，不要添加任何解释、前言或后记，不要使用 markdown 代码块包裹。";
  const estInput = estimateTokens(systemPrompt + userContent);
  const u = todayUsage();
  const currentCost = costYuan(u.inputTokens + estInput, u.outputTokens);
  if (currentCost > DAILY_BUDGET) {
    return NextResponse.json(
      {
        error: `今日 AI 额度已用尽（预算 ¥${DAILY_BUDGET}/天），明日恢复。`,
        used: { inputTokens: u.inputTokens, outputTokens: u.outputTokens, costYuan: +costYuan(u.inputTokens, u.outputTokens).toFixed(4) },
      },
      { status: 429 },
    );
  }

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
          { role: "system", content: systemPrompt },
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

  // 输入 tokens 计数（预估值）
  u.inputTokens += estInput;

  // 流式响应：透传 SSE，结束后统计输出 tokens（从 usage 字段或按字符估算）
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let outBuf = "";
  let outputText = "";
  let sawDone = false;
  // DeepSeek 流式最后一条会带 usage 字段（需 stream_options.include_usage=true，当前未传，使用估算）

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (sawDone) break;
        const chunk = decoder.decode(value, { stream: true });
        outBuf += chunk;
        let nl: number;
        while ((nl = outBuf.indexOf("\n")) !== -1) {
          const line = outBuf.slice(0, nl).trim();
          outBuf = outBuf.slice(nl + 1);
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              sawDone = true;
              break;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) outputText += delta;
            } catch {
              /* ignore */
            }
          }
        }
        await writer.write(value);
        if (sawDone) break;
      }
    } catch {
      /* 客户端断开或上游错误 */
    } finally {
      // 输出 tokens 统计
      u.outputTokens += estimateTokens(outputText);
      try {
        await writer.close();
      } catch {
        /* ignore */
      }
      reader.releaseLock();
      req.signal.removeEventListener("abort", abortOnDisconnect);
    }
  })();

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
