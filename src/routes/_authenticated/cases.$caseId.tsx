import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type CaseRow, DOC_KINDS, FLOW, STATUSES, countryName, fmtDate, milestones, requiredDocs, statusLabel,
} from "@/lib/cases";
import { analyzeDocument, type Analysis } from "@/lib/analyze.functions";
import { downloadCaseSummary } from "@/lib/case-pdf";
import { flagUrl } from "@/lib/visa-data";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Applicant Case — First Fly International" },
      { name: "description", content: "Case timeline, milestones, documents and AI checks for a visa applicant." },
      { property: "og:title", content: "Applicant Case — First Fly International" },
      { property: "og:description", content: "Track status, upload documents and print a case summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasePage,
});

type DocRow = {
  id: string; doc_kind: string; file_name: string; storage_path: string; mime_type: string;
  analysis: Analysis | null; analysis_status: string; created_at: string;
};

function CasePage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeDocument);
  const [c, setC] = useState<CaseRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<string>(DOC_KINDS[0]);
  const [uploading, setUploading] = useState(false);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: cd, error }, { data: dd }] = await Promise.all([
      supabase.from("applicant_cases").select("*").eq("id", caseId).maybeSingle(),
      supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at"),
    ]);
    if (error || !cd) return setErr("Case not found.");
    setC(cd as unknown as CaseRow);
    setDocs((dd ?? []) as unknown as DocRow[]);
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  async function patch(p: Partial<CaseRow>) {
    if (!c) return;
    const next = { ...p, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("applicant_cases").update(next as never).eq("id", c.id);
    if (error) return setErr("Could not save changes.");
    setC({ ...c, ...next } as CaseRow);
  }
  function setStatus(s: string) {
    if (!c || s === c.status) return;
    patch({ status: s, history: [...c.history, { status: s, at: new Date().toISOString() }] });
  }

  async function runAnalysis(id: string) {
    setBusyDoc(id);
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, analysis_status: "running" } : x)));
    try {
      const r = await analyze({ data: { documentId: id } });
      setDocs((d) => d.map((x) => (x.id === id ? { ...x, analysis: r.analysis, analysis_status: "done" } : x)));
    } catch (e) {
      setErr((e as Error).message);
      setDocs((d) => d.map((x) => (x.id === id ? { ...x, analysis_status: "failed" } : x)));
    }
    setBusyDoc(null);
  }

  async function upload(file: File) {
    if (!c) return;
    if (file.size > 10 * 1024 * 1024) return setErr("File is larger than 10 MB.");
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) return setErr("Upload a PDF or an image.");
    setUploading(true);
    setErr(null);
    const { data: u } = await supabase.auth.getUser();
    const path = `${u.user!.id}/${c.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("case-docs").upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(false); return setErr("Upload failed."); }
    const { data: row, error } = await supabase
      .from("case_documents")
      .insert({ case_id: c.id, doc_kind: kind, file_name: file.name, storage_path: path, mime_type: file.type })
      .select("*").single();
    setUploading(false);
    if (error || !row) return setErr("Could not save the document.");
    setDocs((d) => [...d, row as unknown as DocRow]);
    if (c.status === "draft") setStatus("documents");
    runAnalysis(row.id);
  }

  async function openDoc(d: DocRow) {
    const { data } = await supabase.storage.from("case-docs").createSignedUrl(d.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function removeDoc(d: DocRow) {
    await supabase.storage.from("case-docs").remove([d.storage_path]);
    const { error } = await supabase.from("case_documents").delete().eq("id", d.id);
    if (!error) setDocs((x) => x.filter((y) => y.id !== d.id));
  }
  async function removeCase() {
    if (!c || !confirm("Delete this case and its documents?")) return;
    if (docs.length) await supabase.storage.from("case-docs").remove(docs.map((d) => d.storage_path));
    await supabase.from("applicant_cases").delete().eq("id", c.id);
    navigate({ to: "/cases" });
  }

  if (!c) return <div className="p-8 text-center text-sm text-muted-foreground">{err ?? "Loading..."}</div>;

  const idx = FLOW.indexOf(c.status as (typeof FLOW)[number]);
  const kinds = docs.map((d) => d.doc_kind);
  const ms = milestones(c, kinds);
  const required = requiredDocs(c.visa_type);
  const totalIssues = docs.reduce((n, d) => n + (d.analysis?.issues?.length ?? 0), 0);
  const card = "rounded-2xl border bg-card p-4 shadow-soft";

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link to="/cases" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-muted text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <img src={flagUrl(c.country_slug)} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-bold text-navy">{c.applicant_name}</p>
            <p className="truncate text-xs text-muted-foreground">{countryName(c.country_slug)} · {c.visa_type}</p>
          </div>
          <button onClick={() => downloadCaseSummary(c, docs)} className="gradient-blue rounded-full px-3 py-2 text-xs font-bold text-card shadow-glow">PDF</button>
        </header>

        <div className="space-y-3 p-4">
          {err && <p className="rounded-xl bg-fail/10 px-3 py-2 text-sm text-fail">{err}</p>}

          {/* At a glance */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={card}><p className="text-lg font-extrabold text-navy">{Math.max(idx, 0) + 1}/{FLOW.length}</p><p className="text-[0.65rem] text-muted-foreground">Stage</p></div>
            <div className={card}><p className="text-lg font-extrabold text-navy">{required.filter((r) => kinds.includes(r)).length}/{required.length}</p><p className="text-[0.65rem] text-muted-foreground">Required docs</p></div>
            <div className={card}><p className={`text-lg font-extrabold ${totalIssues ? "text-fail" : "text-pass"}`}>{totalIssues}</p><p className="text-[0.65rem] text-muted-foreground">AI flags</p></div>
          </div>

          {/* Timeline */}
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-navy">Status timeline</h2>
              <select aria-label="Change status" value={c.status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-xs text-navy">
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            {c.status === "rejected" && <p className="mb-2 rounded-lg bg-fail/10 px-3 py-2 text-xs font-semibold text-fail">Application rejected</p>}
            <ol className="relative ml-2 border-l-2 border-border">
              {FLOW.map((s, i) => {
                const done = i <= idx;
                const cur = s === c.status;
                const h = c.history.filter((e) => e.status === s).at(-1);
                return (
                  <li key={s} className="mb-3 ml-4 last:mb-0">
                    <span className={`absolute -left-[9px] mt-0.5 h-4 w-4 rounded-full border-2 border-card ${cur ? "gradient-blue ring-4 ring-blue/20" : done ? "bg-pass" : "bg-muted"}`} />
                    <p className={`text-sm ${cur ? "font-bold text-blue" : done ? "font-semibold text-navy" : "text-muted-foreground"}`}>{statusLabel(s)?.label}</p>
                    <p className="text-[0.68rem] text-muted-foreground">{statusLabel(s)?.bn}{h ? ` · ${fmtDate(h.at)}` : ""}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Milestones */}
          <section className={card}>
            <h2 className="mb-2 font-bold text-navy">Upcoming milestones</h2>
            <ul className="space-y-2">
              {ms.map((m) => (
                <li key={m.label} className="flex items-center gap-2 text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold ${m.done ? "bg-pass text-card" : "bg-muted text-muted-foreground"}`}>{m.done ? "✓" : ""}</span>
                  <span className={`flex-1 ${m.done ? "text-muted-foreground line-through" : "text-navy"}`}>{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.date ? fmtDate(m.date) : ""}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[0.65rem] text-muted-foreground">
              {([["submitted_on", "Submitted"], ["biometrics_on", "Biometrics"], ["decision_expected_on", "Decision"]] as const).map(([k, l]) => (
                <label key={k} className="block">{l}
                  <input type="date" value={c[k] ?? ""} onChange={(e) => patch({ [k]: e.target.value || null } as Partial<CaseRow>)}
                    className="mt-0.5 w-full rounded-lg border bg-background px-1.5 py-1 text-xs text-navy" />
                </label>
              ))}
            </div>
          </section>

          {/* Checklist */}
          <section className={card}>
            <h2 className="mb-2 font-bold text-navy">Required documents</h2>
            <div className="flex flex-wrap gap-1.5">
              {required.map((r) => {
                const has = kinds.includes(r);
                return <span key={r} className={`rounded-full px-2.5 py-1 text-xs font-medium ${has ? "bg-pass/15 text-pass" : "bg-fail/10 text-fail"}`}>{has ? "✓" : "✗"} {r}</span>;
              })}
            </div>
          </section>

          {/* Upload */}
          <section className={card}>
            <h2 className="mb-2 font-bold text-navy">Upload document</h2>
            <div className="flex gap-2">
              <select aria-label="Document type" value={kind} onChange={(e) => setKind(e.target.value)} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm text-navy">
                {DOC_KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <label className={`gradient-blue grid cursor-pointer place-items-center rounded-xl px-4 text-sm font-bold text-card shadow-glow ${uploading ? "opacity-60" : ""}`}>
                {uploading ? "Uploading..." : "Choose file"}
                <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
              </label>
            </div>
            <p className="mt-1.5 text-[0.65rem] text-muted-foreground">PDF or photo, up to 10 MB. AI reads it and flags missing or inconsistent details.</p>
          </section>

          {/* Documents + AI */}
          {docs.map((d) => (
            <section key={d.id} className={card}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy">{d.doc_kind}</p>
                  <p className="truncate text-[0.68rem] text-muted-foreground">{d.file_name}</p>
                </div>
                <button onClick={() => openDoc(d)} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-navy">View</button>
                <button onClick={() => removeDoc(d)} className="rounded-full bg-muted px-2.5 py-1 text-xs text-fail">Delete</button>
              </div>
              {d.analysis_status === "running" || busyDoc === d.id ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-blue"><span className="h-3 w-3 animate-spin rounded-full border-2 border-blue border-t-transparent" /> AI is reading the document...</p>
              ) : d.analysis_status === "failed" || d.analysis_status === "pending" ? (
                <button onClick={() => runAnalysis(d.id)} className="mt-3 text-xs font-semibold text-blue">{d.analysis_status === "failed" ? "Analysis failed — retry" : "Run AI check"}</button>
              ) : d.analysis ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-foreground">{d.analysis.summary}</p>
                  {d.analysis.detected_type && d.analysis.detected_type.toLowerCase() !== d.doc_kind.toLowerCase() && (
                    <p className="text-[0.68rem] text-muted-foreground">Detected as: {d.analysis.detected_type}</p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-muted/60 p-2.5 text-[0.7rem]">
                    {d.analysis.fields.map((f) => (
                      <div key={f.label + f.value} className="min-w-0"><dt className="text-muted-foreground">{f.label}</dt><dd className="truncate font-semibold text-navy">{f.value}</dd></div>
                    ))}
                  </dl>
                  {d.analysis.issues.length === 0 ? (
                    <p className="rounded-lg bg-pass/10 px-2.5 py-1.5 text-xs font-semibold text-pass">✓ No problems found</p>
                  ) : (
                    <ul className="space-y-1">
                      {d.analysis.issues.map((i, n) => (
                        <li key={n} className={`rounded-lg px-2.5 py-1.5 text-xs ${i.severity === "warning" ? "bg-gold/15 text-navy" : "bg-fail/10 text-fail"}`}>
                          <b className="uppercase">{i.severity}</b> · {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          ))}

          <textarea defaultValue={c.notes ?? ""} onBlur={(e) => e.target.value !== (c.notes ?? "") && patch({ notes: e.target.value.slice(0, 4000) })}
            placeholder="Case notes..." className="min-h-20 w-full rounded-2xl border bg-card p-3 text-sm outline-none focus:border-blue" />
          <button onClick={removeCase} className="w-full py-2 text-xs font-semibold text-fail">Delete case</button>
        </div>
      </div>
    </div>
  );
}
