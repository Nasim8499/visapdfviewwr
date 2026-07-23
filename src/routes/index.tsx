import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  COUNTRIES,
  DOC_TYPES,
  type Country,
  type DocType,
  flagUrl,
  pdfUrl,
} from "@/lib/visa-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visa PDF Dashboard — Preview & Download" },
      {
        name: "description",
        content:
          "Browse, preview and download visa PDFs — visitor visa, work visa, work permit, sponsorship letter — for 15 countries.",
      },
      { property: "og:title", content: "Visa PDF Dashboard" },
      {
        property: "og:description",
        content: "Preview and download visa PDFs for 15 countries on any device.",
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

function Dashboard() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocType | "All">("All");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q),
    );
  }, [query]);

  const stats = {
    countries: COUNTRIES.length,
    documents: COUNTRIES.length * DOC_TYPES.length,
    types: DOC_TYPES.length,
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="gradient-navy relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-gold/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <span className="font-display text-lg font-bold text-gold">V</span>
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.25em] text-white/60">
                Visa Document Suite
              </p>
              <h1 className="font-display text-2xl leading-tight tracking-[0.15em] text-shadow-soft sm:text-4xl">
                VISA PDF DASHBOARD
              </h1>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-sm text-white/75 sm:text-base">
            Preview, verify and download official-style visa documents for 15 countries — fully
            mobile ready.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="gold">{stats.countries} Countries</Badge>
            <Badge tone="pass">{stats.documents} Documents</Badge>
            <Badge>{stats.types} Types</Badge>
            <Badge tone="pass">All Available</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Search + filter */}
        <section className="sticky top-0 z-20 -mx-4 mt-6 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
              <FilterChip active={filter === "All"} onClick={() => setFilter("All")}>
                All
              </FilterChip>
              {DOC_TYPES.map((d) => (
                <FilterChip
                  key={d.key}
                  active={filter === d.key}
                  onClick={() => setFilter(d.key)}
                >
                  {d.short}
                </FilterChip>
              ))}
            </div>
          </div>
        </section>

        <h2 className="mt-8 flex items-center gap-3 font-display text-lg tracking-[0.15em] text-navy sm:text-xl">
          <span className="h-6 w-1.5 rounded bg-gold" />
          COUNTRIES
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 font-sans text-xs font-semibold text-muted-foreground">
            {filtered.length}
          </span>
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CountryCard
              key={c.slug}
              country={c}
              activeDoc={filter === "All" ? null : filter}
              onPreview={(doc) => setPreview({ country: c, doc })}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
              No countries match “{query}”.
            </div>
          )}
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          <p className="font-mono">
            © {new Date().getFullYear()} Visa PDF Dashboard · Preview & Download Ready
          </p>
        </footer>
      </main>

      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "gold" | "pass";
}) {
  const base =
    "rounded-full border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em]";
  const cls =
    tone === "gold"
      ? "border-gold/40 bg-gold/20 text-gold"
      : tone === "pass"
        ? "border-pass/40 bg-pass/25 text-white"
        : "border-white/15 bg-white/10 text-white/85";
  return <span className={`${base} ${cls}`}>{children}</span>;
}

function FilterChip({
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
          ? "gradient-gold text-white shadow-gold"
          : "gradient-navy text-white/90 hover:brightness-110"
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
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 gradient-gold" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md ring-2 ring-navy/80">
          <img
            src={flagUrl(country.slug)}
            alt={`${country.name} flag`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold tracking-wide text-navy">
            {country.name}
          </h3>
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
            {country.region}
          </p>
        </div>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-pass/15">
          <span className="h-2 w-2 rounded-full bg-pass" />
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {docs.map((d) => (
          <li
            key={d.key}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-2 pl-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy">{d.label}</p>
              <p className="truncate font-mono text-[0.65rem] uppercase text-muted-foreground">
                {country.slug}_{d.key}.pdf
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPreview(d.key)}
              className="gradient-navy rounded-lg px-2.5 py-1.5 text-[0.7rem] font-bold tracking-wide text-white shadow-sm transition active:scale-95"
              aria-label={`Preview ${d.label} for ${country.name}`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => downloadPdf(country.slug, d.key)}
              className="gradient-gold rounded-lg px-2.5 py-1.5 text-[0.7rem] font-bold tracking-wide text-white shadow-gold transition active:scale-95"
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
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-navy/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${country.name} ${label} preview`}
    >
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-card shadow-lift sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="h-7 w-11 overflow-hidden rounded ring-2 ring-navy/80">
            <img src={flagUrl(country.slug)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold tracking-wide text-navy sm:text-base">
              {country.name}
            </p>
            <p className="truncate text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
              {label}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-border bg-muted px-3 py-2 text-xs font-bold tracking-wide text-navy sm:inline-block"
          >
            Open tab
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="gradient-gold hidden rounded-lg px-3 py-2 text-xs font-bold tracking-wide text-white shadow-gold sm:inline-block"
          >
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted text-navy transition hover:bg-muted/70"
            aria-label="Close preview"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="relative flex-1 bg-[#525659]">
          <iframe
            key={url}
            src={`${url}#view=FitH&toolbar=1&navpanes=0`}
            title={`${country.name} ${label}`}
            className="h-full w-full border-0"
          />
        </div>

        <div className="flex gap-2 border-t border-border bg-card p-3 sm:hidden">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="gradient-navy flex-1 rounded-lg py-2.5 text-center text-sm font-bold tracking-wide text-white"
          >
            Open
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="gradient-gold flex-1 rounded-lg py-2.5 text-center text-sm font-bold tracking-wide text-white shadow-gold"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

