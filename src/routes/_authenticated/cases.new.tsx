import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VISA_TYPES } from "@/lib/cases";
import { COUNTRIES } from "@/lib/visa-data";

export const Route = createFileRoute("/_authenticated/cases/new")({
  head: () => ({
    meta: [
      { title: "New Applicant Case — First Fly International" },
      { name: "description", content: "Open a new visa applicant case." },
      { property: "og:title", content: "New Applicant Case — First Fly International" },
      { property: "og:description", content: "Create a case to track documents and visa progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCase,
});

function NewCase() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [passport, setPassport] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0].slug);
  const [visa, setVisa] = useState<string>(VISA_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("applicant_cases")
      .insert({
        applicant_name: name.trim().slice(0, 120),
        passport_no: passport.trim().slice(0, 30) || null,
        country_slug: country,
        visa_type: visa,
        status: "draft",
        history: [{ status: "draft", at: new Date().toISOString() }],
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setErr("Could not create the case.");
    navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
  }

  const field = "w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-blue";
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link to="/cases" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-muted text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <p className="font-bold text-navy">New Applicant</p>
        </header>
        <form onSubmit={submit} className="space-y-3 p-4">
          <label className="block text-xs font-semibold text-navy">Applicant full name (as in passport)
            <input required value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-navy">Passport number
            <input value={passport} onChange={(e) => setPassport(e.target.value.toUpperCase())} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-navy">Destination country
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${field} mt-1`}>
              {COUNTRIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-navy">Visa type
            <select value={visa} onChange={(e) => setVisa(e.target.value)} className={`${field} mt-1`}>
              {VISA_TYPES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          {err && <p className="text-sm text-fail">{err}</p>}
          <button disabled={busy} className="gradient-blue w-full rounded-2xl py-3.5 text-sm font-bold text-card shadow-glow disabled:opacity-60">
            {busy ? "Creating..." : "Create case"}
          </button>
        </form>
      </div>
    </div>
  );
}
