import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { scanPassport } from "@/lib/analyze.functions";
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function NewCase() {
  const navigate = useNavigate();
  const scan = useServerFn(scanPassport);
  const [name, setName] = useState("");
  const [passport, setPassport] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0].slug);
  const [visa, setVisa] = useState<string>(VISA_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setScanMsg(null);
    if (file.size > 6 * 1024 * 1024) return setScanMsg("Photo is larger than 6 MB.");
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setScanning(true);
    try {
      const { scan: s } = await scan({ data: { image: dataUrl.split(",")[1], mediaType: file.type || "image/jpeg" } });
      if (!s.readable) {
        setScanMsg("This doesn't look like a readable passport or ID. Please fill in manually.");
        return;
      }
      const filled: string[] = [];
      if (s.full_name) { setName(s.full_name); filled.push("name"); }
      if (s.passport_no) { setPassport(s.passport_no.toUpperCase()); filled.push("passport number"); }
      if (s.date_of_birth && /^\d{4}-\d{2}-\d{2}$/.test(s.date_of_birth)) { setDob(s.date_of_birth); filled.push("date of birth"); }
      if (s.nationality) {
        setNationality(s.nationality);
        filled.push("nationality");
        const match = COUNTRIES.find((c) => norm(c.name) === norm(s.nationality!));
        if (match) setCountry(match.slug);
      }
      setScanMsg(filled.length ? `Auto-filled: ${filled.join(", ")}. Please double-check.` : "No details could be read. Please fill in manually.");
    } catch (e) {
      setScanMsg((e as Error).message || "Could not read the photo.");
    } finally {
      setScanning(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("applicant_cases")
      .insert({
        applicant_name: name.trim().slice(0, 120),
        passport_no: passport.trim().slice(0, 30) || null,
        date_of_birth: dob || null,
        nationality: nationality.trim().slice(0, 60) || null,
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
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-blue bg-card p-4 shadow-soft">
            {preview ? (
              <img src={preview} alt="Document photo" className="h-14 w-20 rounded-lg object-cover" />
            ) : (
              <span className="gradient-blue grid h-14 w-14 place-items-center rounded-xl text-card">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </span>
            )}
            <span className="flex-1">
              <span className="block text-sm font-bold text-navy">{scanning ? "Reading document..." : "Scan passport / ID photo"}</span>
              <span className="block text-xs text-muted-foreground">AI fills name, passport no., date of birth and country</span>
            </span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanning} onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {scanMsg && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-xs text-navy">{scanMsg}</p>}
          <label className="block text-xs font-semibold text-navy">Applicant full name (as in passport)
            <input required value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-navy">Passport number
            <input value={passport} onChange={(e) => setPassport(e.target.value.toUpperCase())} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-navy">Date of birth
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-navy">Nationality
            <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={`${field} mt-1`} />
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
