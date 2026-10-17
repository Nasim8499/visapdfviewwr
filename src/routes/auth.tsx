import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { oauthReturnPath } from "@/lib/oauth-return-path";

const safeNext = (n: unknown) => oauthReturnPath(n, "/chat");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === "string" ? s.next : undefined }),
  head: () => ({
    meta: [
      { title: "লগইন — First Fly ভিসা সহকারী" },
      { name: "description", content: "আপনার ভিসা চ্যাট ইতিহাস সংরক্ষণ করতে লগইন করুন।" },
      { property: "og:title", content: "লগইন — First Fly International" },
      { property: "og:description", content: "চ্যাট ইতিহাস দেখতে ও সংরক্ষণ করতে লগইন করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: target });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ href: target });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("ইমেইল বা পাসওয়ার্ড ভুল।");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: new URL(target, window.location.origin).href },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("আপনার ইমেইলে একটি নিশ্চিতকরণ লিংক পাঠানো হয়েছে।");
    }
    setBusy(false);
  }

  async function google() {
    sessionStorage.setItem("ff_next", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth?next=" + encodeURIComponent(target) });
    if (r.error) setMsg("Google লগইন ব্যর্থ হয়েছে।");
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="font-display text-3xl font-extrabold italic">
          <span className="text-blue">First</span> <span className="text-gold">Fly</span>
        </p>
        <h1 className="mt-4 text-2xl font-extrabold text-navy">{mode === "in" ? "লগইন করুন" : "অ্যাকাউন্ট খুলুন"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">ভিসা সহকারীর সাথে আপনার সব চ্যাট সংরক্ষিত থাকবে।</p>
        <button onClick={google} className="mt-6 w-full rounded-2xl border bg-card py-3 text-sm font-semibold text-navy shadow-soft">
          Google দিয়ে চালিয়ে যান
        </button>
        <div className="my-4 text-center text-xs text-muted-foreground">অথবা</div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ইমেইল"
            className="w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-blue" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="পাসওয়ার্ড"
            className="w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-blue" />
          <button disabled={busy} className="gradient-blue w-full rounded-2xl py-3 text-sm font-bold text-card shadow-glow disabled:opacity-60">
            {mode === "in" ? "লগইন" : "সাইন আপ"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-navy">{msg}</p>}
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm font-semibold text-blue">
          {mode === "in" ? "নতুন? অ্যাকাউন্ট খুলুন" : "আগে থেকেই অ্যাকাউন্ট আছে? লগইন"}
        </button>
      </div>
    </div>
  );
}
