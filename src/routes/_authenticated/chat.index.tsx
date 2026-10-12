import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "চ্যাট ইতিহাস — First Fly ভিসা সহকারী" },
      { name: "description", content: "আপনার আগের ভিসা সহকারী কথোপকথনগুলো দেখুন ও আবার শুরু করুন।" },
      { property: "og:title", content: "চ্যাট ইতিহাস — First Fly International" },
      { property: "og:description", content: "সংরক্ষিত ভিসা চ্যাটগুলো এক জায়গায়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatList,
});

type Thread = { id: string; title: string; updated_at: string };

export async function createThread() {
  const { data, error } = await supabase.from("chat_threads").insert({}).select("id").single();
  if (error) throw error;
  return data.id;
}

function ChatList() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from("chat_threads").select("id,title,updated_at").order("updated_at", { ascending: false });
    if (error) setErr("চ্যাট লোড করা যায়নি।");
    setThreads(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function startNew() {
    try {
      const id = await createThread();
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch {
      setErr("নতুন চ্যাট খোলা যায়নি।");
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) setErr("মুছে ফেলা যায়নি।");
    else setThreads((t) => t?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link to="/" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-muted text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <p className="flex-1 font-bold text-navy">আমার চ্যাটসমূহ</p>
          <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-navy">লগআউট</button>
        </header>
        <div className="space-y-2.5 p-4">
          <button onClick={startNew} className="gradient-blue w-full rounded-2xl py-3.5 text-sm font-bold text-card shadow-glow">+ নতুন চ্যাট শুরু করুন</button>
          {err && <p className="text-sm text-fail">{err}</p>}
          {threads === null && <p className="py-6 text-center text-sm text-muted-foreground">লোড হচ্ছে...</p>}
          {threads?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">এখনো কোনো চ্যাট নেই।</p>}
          {threads?.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl border bg-card p-3 shadow-soft">
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{t.title}</p>
                <p className="text-[0.7rem] text-muted-foreground">{new Date(t.updated_at).toLocaleString("bn-BD")}</p>
              </Link>
              <button onClick={() => remove(t.id)} aria-label="Delete chat" className="rounded-full bg-muted px-2.5 py-1 text-xs text-fail">মুছুন</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
