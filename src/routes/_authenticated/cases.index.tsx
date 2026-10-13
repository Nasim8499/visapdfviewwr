import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type CaseRow, STATUSES, VISA_TYPES, countryName, fmtDate, statusLabel } from "@/lib/cases";
import { flagUrl } from "@/lib/visa-data";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Applicant Cases — First Fly International" },
      { name: "description", content: "Search and filter visa applicant cases by name, visa type and status." },
      { property: "og:title", content: "Applicant Cases — First Fly International" },
      { property: "og:description", content: "Track every visa applicant case at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasesPage,
});

const statusTone: Record<string, string> = {
  approved: "bg-pass/15 text-pass",
  rejected: "bg-fail/15 text-fail",
  draft: "bg-muted text-muted-foreground",
};

function CasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [visa, setVisa] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase.from("applicant_cases").select("*").order("updated_at", { ascending: false }).then(({ data, error }) => {
      if (error) setErr("Could not load cases.");
      setCases((data ?? []) as unknown as CaseRow[]);
    });
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cases ?? []).filter(
      (c) =>
        (!t || c.applicant_name.toLowerCase().includes(t) || (c.passport_no ?? "").toLowerCase().includes(t) || countryName(c.country_slug).toLowerCase().includes(t)) &&
        (!visa || c.visa_type === visa) &&
        (!status || c.status === status),
    );
  }, [cases, q, visa, status]);

  const sel = "min-w-0 flex-1 rounded-xl border bg-card px-3 py-2.5 text-sm text-navy outline-none";

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link to="/" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-muted text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <p className="flex-1 font-bold text-navy">Applicant Cases</p>
          <Link to="/cases/new" className="gradient-blue rounded-full px-4 py-2 text-xs font-bold text-card shadow-glow">+ New</Link>
        </header>

        <div className="space-y-2 p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicant, passport or country..."
            className="w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-blue" />
          <div className="flex gap-2">
            <select aria-label="Visa type" value={visa} onChange={(e) => setVisa(e.target.value)} className={sel}>
              <option value="">All visa types</option>
              {VISA_TYPES.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUSES.map((s) => {
              const n = (cases ?? []).filter((c) => c.status === s.key).length;
              return (
                <button key={s.key} onClick={() => setStatus(status === s.key ? "" : s.key)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status === s.key ? "gradient-blue text-card" : "bg-card text-navy"}`}>
                  {s.label} · {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 px-4">
          {err && <p className="text-sm text-fail">{err}</p>}
          {cases === null && <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>}
          {cases?.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-center shadow-soft">
              <p className="font-semibold text-navy">No cases yet</p>
              <Link to="/cases/new" className="mt-3 inline-block text-sm font-semibold text-blue">Create the first applicant case →</Link>
            </div>
          )}
          {cases && cases.length > 0 && filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No cases match these filters.</p>}
          {filtered.map((c) => (
            <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft active:scale-[0.99]">
              <img src={flagUrl(c.country_slug)} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{c.applicant_name}</p>
                <p className="truncate text-xs text-muted-foreground">{countryName(c.country_slug)} · {c.visa_type}</p>
                <p className="text-[0.65rem] text-muted-foreground">Updated {fmtDate(c.updated_at)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${statusTone[c.status] ?? "bg-blue/10 text-blue"}`}>
                {statusLabel(c.status)?.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
