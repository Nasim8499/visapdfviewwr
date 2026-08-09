import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  COUNTRIES,
  DOC_TYPES,
  type Country,
  type DocType,
  flagUrl,
  pdfUrl,
} from "@/lib/visa-data";
import { PdfViewer } from "@/components/PdfViewer";
import agentImg from "@/assets/visa-agent.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Visas — Visa Agent Document App" },
      {
        name: "description",
        content:
          "Visa Agent app: browse tourist, work, permit and sponsorship visa documents for 15 countries, preview every PDF in-app and download instantly.",
      },
      { property: "og:title", content: "Your Visas — Visa Agent" },
      {
        property: "og:description",
        content: "Preview and download 60 visa documents across 15 countries on any device.",
      },
    ],
  }),
  component: Dashboard,
});

async function downloadPdf(slug: string, doc: DocType) {
  const url = pdfUrl(slug, doc);
  const filename = `${slug}_${doc}.pdf`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

interface PreviewDoc {
  country: Country;
  doc: DocType;
}

const DOC_ICON: Record<DocType, string> = {
  Visitor_Visa: "M3 7h18v12H3z M3 11h18",
  Work_Visa: "M4 8h16v11H4z M9 8V6h6v2",
  Work_Permit: "M6 3h9l4 4v14H6z M14 3v5h5",
  Sponsorship_Letter: "M3 6h18v12H3z M3 7l9 6 9-6",
};

function Dashboard() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocType | "All">("All");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q),
    );
  }, [query]);

  const totalDocs = COUNTRIES.length * DOC_TYPES.length;

  function jumpToList(next: DocType | "All") {
    setFilter(next);
    setTimeout(
      () => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      30,
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-md">
        {/* App bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-navy/90 px-4 py-3 backdrop-blur">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-sky" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M7 12h4" />
            </svg>
          </span>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-white">
            Your Visas
          </h1>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
            </svg>
          </span>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white tabular-nums">
            {totalDocs}
          </span>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <img
            src={agentImg}
            alt="Visa agent"
            width={1024}
            height={1280}
            className="h-[420px] w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-navy/25 to-navy" />

          <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-wide text-white text-shadow-soft">
                VISA AGENT
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {COUNTRIES.length} Countries · {DOC_TYPES.length} Classes
              </p>
            </div>

            <ul className="mt-4 space-y-2.5">
              {DOC_TYPES.map((d) => (
                <li key={d.key}>
                  <button
                    type="button"
                    onClick={() => jumpToList(d.key)}
                    className="glass-row flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.98]"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-sky" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d={DOC_ICON[d.key]} />
                    </svg>
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold text-white">
                      {d.label}
                    </span>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/70" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => jumpToList("All")}
                  className="gradient-blue flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left shadow-glow transition active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="flex-1 text-lg font-bold tracking-wide text-white">
                    ALL VISAS
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </section>

        {/* Stats */}
        <section className="px-4">
          <div className="grid grid-cols-4 divide-x divide-white/10 rounded-xl border border-white/12 bg-white/5 py-2.5">
            <Stat value={totalDocs} label="Documents" />
            <Stat value={COUNTRIES.length} label="Countries" />
            <Stat value={DOC_TYPES.length} label="Types" />
            <Stat value="100%" label="Ready" />
          </div>

          <button
            type="button"
            onClick={() => jumpToList("All")}
            className="gradient-blue mt-3 w-full rounded-xl py-3.5 text-xl font-extrabold tracking-wide text-white shadow-glow transition active:scale-[0.98]"
          >
            BUILD IT NOW
          </button>
        </section>

        {/* Search + filters */}
        <section ref={listRef} className="scroll-mt-16 px-4 pt-6">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder="Search country or region…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-sky/60 focus:ring-4 focus:ring-sky/15"
            />
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={filter === "All"} onClick={() => setFilter("All")}>
              All
            </Chip>
            {DOC_TYPES.map((d) => (
              <Chip key={d.key} active={filter === d.key} onClick={() => setFilter(d.key)}>
                {d.short}
              </Chip>
            ))}
          </div>

          <h3 className="mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-white/70">
            Countries
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tracking-normal text-white/80">
              {filtered.length}
            </span>
          </h3>

          <div className="mt-3 space-y-3">
            {filtered.map((c) => (
              <CountryCard
                key={c.slug}
                country={c}
                activeDoc={filter === "All" ? null : filter}
                onPreview={(doc) => setPreview({ country: c, doc })}
              />
            ))}
            {filtered.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/60">
                No countries match “{query}”.
              </p>
            )}
          </div>

          <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-white/45">
            © {new Date().getFullYear()} Visa Agent · Preview &amp; Download Ready
          </footer>
        </section>
      </div>

      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="px-1 text-center">
      <p className="text-base font-bold text-white tabular-nums">{value}</p>
      <p className="truncate text-[0.65rem] uppercase tracking-wide text-white/55">{label}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide transition ${
        active
          ? "gradient-blue text-white shadow-glow"
          : "border border-white/12 bg-white/5 text-white/75"
      }`}
    >
      {children}
    </button>
  );
}

function CountryCard({
  country,
  activeDoc,
  onPreview,
}: {
  country: Country;
  activeDoc: DocType | null;
  onPreview: (doc: DocType) => void;
}) {
  const docs = activeDoc ? DOC_TYPES.filter((d) => d.key === activeDoc) : DOC_TYPES;
  return (
    <article className="overflow-hidden rounded-2xl border border-white/12 bg-white/5">
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-3 py-2.5">
        <div className="h-8 w-12 shrink-0 overflow-hidden rounded ring-1 ring-white/25">
          <img
            src={flagUrl(country.slug)}
            alt={`${country.name} flag`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-bold text-white">{country.name}</h4>
          <p className="truncate text-[0.65rem] uppercase tracking-[0.15em] text-white/50">
            {country.region}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-pass/20 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-pass">
          Available
        </span>
      </div>

      <ul className="divide-y divide-white/8">
        {docs.map((d) => (
          <li key={d.key} className="flex items-center gap-2 px-3 py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-sky" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={DOC_ICON[d.key]} />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{d.label}</p>
              <p className="truncate font-mono text-[0.6rem] uppercase text-white/40">
                {country.slug}_{d.key}.pdf
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPreview(d.key)}
              className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[0.7rem] font-bold text-white transition active:scale-95"
              aria-label={`Preview ${d.label} for ${country.name}`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => downloadPdf(country.slug, d.key)}
              className="gradient-blue shrink-0 rounded-lg px-2.5 py-1.5 text-[0.7rem] font-bold text-white shadow-glow transition active:scale-95"
              aria-label={`Download ${d.label} for ${country.name}`}
            >
              PDF
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PreviewModal({
  preview,
  onClose,
}: {
  preview: PreviewDoc;
  onClose: () => void;
}) {
  const { country, doc } = preview;
  const url = pdfUrl(country.slug, doc);
  const label = DOC_TYPES.find((d) => d.key === doc)?.label ?? doc;
  const filename = `${country.slug}_${doc}.pdf`;

  async function handleDownload() {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${country.name} ${label} preview`}
    >
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-navy shadow-lift sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="h-7 w-11 overflow-hidden rounded ring-1 ring-white/25">
            <img src={flagUrl(country.slug)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white sm:text-base">{country.name}</p>
            <p className="truncate text-[0.7rem] uppercase tracking-[0.15em] text-white/55">
              {label}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white sm:inline-block"
          >
            Open tab
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="gradient-blue hidden rounded-lg px-3 py-2 text-xs font-bold text-white shadow-glow sm:inline-block"
          >
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/10 text-white"
            aria-label="Close preview"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[#525659]">
          <PdfViewer url={url} />
        </div>

        <div className="flex gap-2 border-t border-white/10 p-3 sm:hidden">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-lg border border-white/15 bg-white/10 py-2.5 text-center text-sm font-bold text-white"
          >
            Open
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="gradient-blue flex-1 rounded-lg py-2.5 text-center text-sm font-bold text-white shadow-glow"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
