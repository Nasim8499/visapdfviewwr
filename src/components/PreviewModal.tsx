import { DOC_TYPES, type Country, type DocType, flagUrl, pdfUrl } from "@/lib/visa-data";
import { PdfViewer } from "@/components/PdfViewer";

export async function downloadPdf(slug: string, doc: DocType) {
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

const X = "M6 6l12 12 M18 6L6 18";

export function PreviewModal({ country, doc, onClose }: { country: Country; doc: DocType; onClose: () => void }) {
  const url = pdfUrl(country.slug, doc);
  const label = DOC_TYPES.find((d) => d.key === doc)?.label ?? doc;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-navy/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${country.name} ${label} preview`}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-card shadow-lift sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <img src={flagUrl(country.slug)} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-navy">{country.name}</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">{label}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-navy" aria-label="Close preview">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={X} /></svg>
          </button>
        </div>
        <div className="relative flex-1 overflow-hidden bg-viewer">
          <PdfViewer url={url} />
        </div>
        <div className="flex gap-2 border-t p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <a href={url} target="_blank" rel="noreferrer" className="flex-1 rounded-xl border bg-muted py-2.5 text-center text-sm font-bold text-navy">Open</a>
          <button onClick={() => downloadPdf(country.slug, doc)} className="gradient-blue flex-1 rounded-xl py-2.5 text-center text-sm font-bold text-card shadow-glow">Download</button>
        </div>
      </div>
    </div>
  );
}
