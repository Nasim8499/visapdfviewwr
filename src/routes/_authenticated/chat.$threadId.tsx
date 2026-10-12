import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { COUNTRIES, DOC_TYPES, type Country, type DocType, flagUrl } from "@/lib/visa-data";
import { PreviewModal, downloadPdf } from "@/components/PreviewModal";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "ভিসা সহকারী চ্যাট — First Fly International" },
      { name: "description", content: "বাংলায় ভিসা পরামর্শ, দেশভিত্তিক ডকুমেন্ট প্রিভিউ ও ডাউনলোড — First Fly AI ভিসা সহকারী।" },
      { property: "og:title", content: "First Fly ভিসা সহকারী চ্যাট" },
      { property: "og:description", content: "১৫টি দেশের ভিসা তথ্য ও ১০৫টি PDF ডকুমেন্ট চ্যাটেই দেখুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; error?: string };

const GREETING: Msg = {
  id: "hello",
  role: "assistant",
  content:
    "আসসালামু আলাইকুম! 👋 আমি **ফার্স্ট ফ্লাই ভিসা সহকারী**।\n\nআমি আপনাকে সাহায্য করতে পারি:\n- ১৫টি দেশের কাজের ভিসা, ওয়ার্ক পারমিট ও ভিজিট ভিসা\n- আবেদন জমা, প্রয়োজনীয় কাগজপত্র ও প্রসেসিং সময়\n- যেকোনো দেশের **৭টি PDF ডকুমেন্ট** প্রিভিউ ও ডাউনলোড\n\nকোন দেশ নিয়ে জানতে চান?",
};

const CHIPS = [
  "সৌদি আরবের কাজের ভিসার কাগজপত্র কী কী?",
  "মালয়েশিয়ার সব ডকুমেন্ট দেখাও",
  "সার্বিয়া ওয়ার্ক পারমিট প্রসেসিং সময়",
  "ভিসা আবেদন জমার ধাপগুলো বলো",
  "দুবাই (UAE) এমপ্লয়মেন্ট এগ্রিমেন্ট",
];

const DOC_RE = /\[\[DOC:([A-Za-z_]+):([A-Za-z_]+)\]\]/g;
const ERR_RE = /\[\[ERR:([^\]]+)\]\]/;

function parse(content: string) {
  const docs: { country: Country; doc: DocType }[] = [];
  for (const m of content.matchAll(DOC_RE)) {
    const country = COUNTRIES.find((c) => c.slug === m[1]);
    const doc = DOC_TYPES.find((d) => d.key === m[2])?.key;
    if (country && doc && !docs.some((x) => x.country.slug === country.slug && x.doc === doc)) docs.push({ country, doc });
  }
  const err = content.match(ERR_RE)?.[1];
  const text = content.replace(DOC_RE, "").replace(ERR_RE, "").replace(/\[\[[^\]]*$/, "").trim();
  return { text, docs, err };
}

function ChatPage() {
  const { threadId } = Route.useParams();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    supabase.from("chat_messages").select("id,role,content").eq("thread_id", threadId).order("created_at").then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error(error);
      setMessages([GREETING, ...((data ?? []) as Msg[])]);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [threadId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ country: Country; doc: DocType } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const user: Msg = { id: crypto.randomUUID(), role: "user", content: q };
    const botId = crypto.randomUUID();
    const history = [...messages.filter((m) => m.id !== "hello" && !m.error), user];
    const isFirst = history.length === 1;
    const { error: saveErr } = await supabase.from("chat_messages").insert({ thread_id: threadId, role: "user", content: q });
    if (saveErr) console.error("save user msg", saveErr);
    await supabase.from("chat_threads").update({ updated_at: new Date().toISOString(), ...(isFirst ? { title: q.slice(0, 60) } : {}) }).eq("id", threadId);
    setMessages((m) => [...m, user, { id: botId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "সার্ভার ত্রুটি");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: acc } : x)));
      }
      if (acc.trim() && !/\[\[ERR:/.test(acc)) {
        const { error: e2 } = await supabase.from("chat_messages").insert({ thread_id: threadId, role: "assistant", content: acc });
        if (e2) console.error("save assistant msg", e2);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, error: (e as Error).message || "ত্রুটি হয়েছে" } : x)));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link to="/" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-muted text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="gradient-blue grid h-10 w-10 place-items-center rounded-2xl text-card shadow-glow">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16l20-8-6 12-3-5z M13 15l-4 5" /></svg>
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-bold text-navy">ফার্স্ট ফ্লাই ভিসা সহকারী</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-pass" /> {busy ? "লিখছে..." : "অনলাইন"}
            </p>
          </div>
          <Link to="/chat" onClick={() => abortRef.current?.abort()} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-navy">
            সব চ্যাট
          </Link>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((m) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="gradient-blue max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-card shadow-glow">{m.content}</p>
                </div>
              );
            const { text, docs, err } = parse(m.content);
            const waiting = !text && !m.error && !err && busy;
            return (
              <div key={m.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-blue">FF</span>
                <div className="min-w-0 flex-1 space-y-2">
                  {waiting && (
                    <div className="inline-flex gap-1 rounded-2xl bg-card px-4 py-3 shadow-soft">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-blue" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  )}
                  {text && (
                    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_li]:my-0.5 [&_p]:my-1.5 [&_strong]:text-navy [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                  {docs.length > 0 && (
                    <div className="space-y-2">
                      {docs.map(({ country, doc }) => (
                        <div key={country.slug + doc} className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 shadow-soft animate-in fade-in zoom-in-95 duration-300">
                          <img src={flagUrl(country.slug)} alt="" className="h-9 w-9 rounded-full object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{DOC_TYPES.find((d) => d.key === doc)?.label}</p>
                            <p className="truncate text-[0.68rem] text-muted-foreground">{country.name} · PDF</p>
                          </div>
                          <button onClick={() => setPreview({ country, doc })} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-navy">প্রিভিউ</button>
                          <button onClick={() => downloadPdf(country.slug, doc)} className="gradient-blue rounded-full px-3 py-1.5 text-xs font-semibold text-card">ডাউনলোড</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(m.error || err) && (
                    <p className="rounded-xl bg-fail/10 px-3 py-2 text-xs font-medium text-fail">{m.error || err}</p>
                  )}
                </div>
              </div>
            );
          })}
          {loaded && messages.length === 1 && (
            <div className="flex flex-wrap gap-2 pl-9">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => send(c)} className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-navy shadow-soft active:scale-95">
                  {c}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 border-t bg-card px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="আপনার প্রশ্ন লিখুন..."
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-base outline-none focus:border-blue"
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy text-card">
              <span className="h-3.5 w-3.5 rounded-sm bg-card" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Send" className="gradient-blue grid h-11 w-11 shrink-0 place-items-center rounded-full text-card shadow-glow disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14 M13 6l6 6-6 6" /></svg>
            </button>
          )}
        </form>
      </div>
      {preview && <PreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
