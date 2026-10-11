import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { COUNTRIES, DOC_TYPES } from "@/lib/visa-data";

const SYSTEM = `তুমি "ফার্স্ট ফ্লাই ভিসা সহকারী" — First Fly International-এর একজন অভিজ্ঞ ভিসা পরামর্শক।
নিয়ম:
- সবসময় সহজ, আন্তরিক, শুদ্ধ বাংলায় উত্তর দাও (দেশ ও ডকুমেন্টের নাম ইংরেজিতে রাখা যাবে)।
- দক্ষতা: ভিসা আবেদন জমা, কাজের ভিসা, ওয়ার্ক পারমিট, স্পন্সরশিপ, এমপ্লয়মেন্ট এগ্রিমেন্ট, প্রয়োজনীয় কাগজপত্রের তালিকা, প্রসেসিং সময়, বায়োমেট্রিক, মেডিকেল, পুলিশ ক্লিয়ারেন্স, ফি ও ধাপে ধাপে গাইড।
- উত্তর সংক্ষিপ্ত শিরোনাম, বুলেট ও ধাপসহ Markdown-এ দাও।
- নির্দিষ্ট দেশের তথ্য দিলে দেশভিত্তিক আলাদা অংশ করো।
- ফি/সময় পরিবর্তনশীল — অফিসিয়াল সূত্রে যাচাই করতে বলো।
- প্রাসঙ্গিক PDF দেখাতে উত্তরের শেষে আলাদা লাইনে ঠিক এই ফরম্যাটে ট্যাগ দাও: [[DOC:<slug>:<doc>]] (একাধিক হতে পারে, সর্বোচ্চ ৭টি)।
উপলব্ধ দেশ (slug): ${COUNTRIES.map((c) => `${c.name}=${c.slug}`).join(", ")}
উপলব্ধ ডকুমেন্ট (doc): ${DOC_TYPES.map((d) => `${d.label}=${d.key}`).join(", ")}
তালিকার বাইরে কোনো slug/doc বানাবে না।`;

export async function handleChat(request: Request) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return new Response("AI কনফিগার করা নেই।", { status: 500 });
  let messages: ModelMessage[];
  try {
    const body = (await request.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
    messages = body.messages.slice(-30).map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }));
  } catch {
    return new Response("ভুল অনুরোধ।", { status: 400 });
  }
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let upstreamError: { status?: number; message?: string } | null = null;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: SYSTEM,
    messages,
    abortSignal: request.signal,
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onError: ({ error }) => {
      const e = error as { statusCode?: number; message?: string };
      upstreamError = { status: e.statusCode, message: e.message };
      console.error("chat error", e.statusCode, e.message);
    },
  });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const chunk of result.textStream) controller.enqueue(enc.encode(chunk));
        if (upstreamError) {
          const s = (upstreamError as { status?: number }).status;
          const msg =
            s === 429 ? "অনেক বেশি অনুরোধ — একটু পরে আবার চেষ্টা করুন।"
            : s === 402 ? "AI ক্রেডিট শেষ — ওয়ার্কস্পেসে ক্রেডিট যোগ করুন।"
            : "উত্তর তৈরি করা যায়নি, আবার চেষ্টা করুন।";
          controller.enqueue(enc.encode(`\n\n[[ERR:${msg}]]`));
        }
      } catch {
        controller.enqueue(enc.encode("\n\n[[ERR:সংযোগ বিচ্ছিন্ন হয়েছে।]]"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
