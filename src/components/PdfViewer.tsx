import { useEffect, useRef, useState } from "react";

type Diag = {
  step: string;
  url: string;
  workerSrc: string;
  workerMode: string;
  pdfjsVersion: string;
  userAgent: string;
  httpStatus?: string;
  contentType?: string;
  bytes?: string;
  magic?: string;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  timing: string[];
};

// pdf.js worker (Vite-friendly, with CDN fallback)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | null = null;
let workerMode = "unknown";
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const version = (pdfjs as any).version as string;
      try {
        const workerUrl = (
          await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        workerMode = "bundled";
      } catch (e) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
        workerMode = `cdn-fallback (${(e as Error)?.message ?? "unknown"})`;
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);
  const [failedPages, setFailedPages] = useState<number[]>([]);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [copied, setCopied] = useState(false);


  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setStatus("loading");
    setDiag(null);
    setShowDiag(false);

    const t0 = performance.now();
    const timing: string[] = [];
    const mark = (label: string) =>
      timing.push(`${label}: ${Math.round(performance.now() - t0)}ms`);

    const d: Diag = {
      step: "init",
      url,
      workerSrc: "",
      workerMode: "pending",
      pdfjsVersion: "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      timing,
    };

    (async () => {
      try {
        d.step = "loading pdf.js module";
        const pdfjs = await loadPdfjs();
        mark("pdfjs loaded");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.pdfjsVersion = (pdfjs as any).version ?? "unknown";
        d.workerSrc = String(pdfjs.GlobalWorkerOptions.workerSrc ?? "");
        d.workerMode = workerMode;

        // Probe the file itself so network/MIME failures are explicit.
        d.step = "fetching PDF bytes";
        let data: ArrayBuffer | undefined;
        try {
          const res = await fetch(url);
          d.httpStatus = `${res.status} ${res.statusText}`;
          d.contentType = res.headers.get("content-type") ?? "(none)";
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          data = await res.arrayBuffer();
          d.bytes = `${data.byteLength}`;
          const head = new TextDecoder().decode(new Uint8Array(data.slice(0, 5)));
          d.magic = JSON.stringify(head);
          if (!head.startsWith("%PDF")) {
            throw new Error(
              `Response is not a PDF (starts with ${JSON.stringify(head)}, content-type ${d.contentType})`,
            );
          }
          mark("bytes fetched");
        } catch (fetchErr) {
          d.step = "fetch failed";
          throw fetchErr;
        }

        if (cancelled) return;

        d.step = "parsing document";
        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        mark("document parsed");
        if (cancelled) return;
        setPages(pdf.numPages);

        const containerWidth = container.clientWidth - 16; // padding allowance
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const renderPage = async (i: number, slot: HTMLDivElement) => {
          slot.innerHTML = "";
          const page = await pdf.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.max(0.5, containerWidth / baseViewport.width);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className =
            "mx-auto block rounded-md bg-white shadow-md ring-1 ring-black/10";

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas 2d context unavailable on this device");
          ctx.scale(dpr, dpr);

          slot.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        };

        const showPageError = (i: number, slot: HTMLDivElement, err: unknown) => {
          const e = err as Error;
          console.error(`PDF page ${i} render failed`, {
            page: i,
            url,
            pdfjsVersion: d.pdfjsVersion,
            workerMode: d.workerMode,
            errorName: e?.name ?? typeof err,
            errorMessage: e?.message ?? String(err),
            errorStack: (e?.stack ?? "").split("\n").slice(0, 6).join("\n"),
            raw: err,
          });

          slot.innerHTML = "";
          const box = document.createElement("div");
          box.className =
            "mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-md border border-dashed border-white/30 bg-black/30 p-5 text-center";
          const title = document.createElement("p");
          title.className = "text-xs font-semibold text-white";
          title.textContent = `Page ${i} couldn’t be displayed`;
          const sub = document.createElement("p");
          sub.className = "text-[0.65rem] text-white/70";
          sub.textContent =
            "The rest of the document is fine — you can retry just this page.";
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "mt-1 rounded-lg bg-white/15 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-white";
          btn.textContent = "Retry page";
          btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = "Retrying…";
            try {
              await renderPage(i, slot);
              setFailedPages((prev) => prev.filter((p) => p !== i));
            } catch (retryErr) {
              showPageError(i, slot, retryErr);
            }
          };
          box.append(title, sub, btn);
          slot.appendChild(box);
          setFailedPages((prev) => (prev.includes(i) ? prev : [...prev, i].sort((a, b) => a - b)));
        };

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          d.step = `rendering page ${i}/${pdf.numPages}`;
          const wrap = document.createElement("div");
          wrap.className = "mb-3 flex justify-center";
          container.appendChild(wrap);
          try {
            await renderPage(i, wrap);
          } catch (pageErr) {
            if (cancelled) return;
            showPageError(i, wrap, pageErr);
          }
        }
        mark("all pages rendered");
        if (!cancelled) setStatus("ready");

      } catch (err) {
        const e = err as Error & { name?: string };
        d.errorName = e?.name ?? typeof err;
        d.errorMessage = e?.message ?? String(err);
        d.errorStack = (e?.stack ?? "").split("\n").slice(0, 6).join("\n");
        mark("failed");
        console.error("PDF render failed", { ...d, raw: err });
        if (!cancelled) {
          setDiag({ ...d });
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  function diagText(x: Diag) {
    return [
      `Failure step: ${x.step}`,
      `Error: ${x.errorName}: ${x.errorMessage}`,
      `URL: ${x.url}`,
      `HTTP: ${x.httpStatus ?? "n/a"}`,
      `Content-Type: ${x.contentType ?? "n/a"}`,
      `Bytes: ${x.bytes ?? "n/a"}  Magic: ${x.magic ?? "n/a"}`,
      `pdf.js: ${x.pdfjsVersion} (worker ${x.workerMode})`,
      `Worker src: ${x.workerSrc}`,
      `Timing: ${x.timing.join(" | ")}`,
      `UA: ${x.userAgent}`,
      `Stack:\n${x.errorStack ?? ""}`,
    ].join("\n");
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-[#525659] px-2 py-3">
      <div ref={containerRef} />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white">
            Loading PDF…
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col bg-[#525659]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold text-white">
              Couldn’t render — {diag?.errorName}: {diag?.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setShowDiag((v) => !v)}
              className="shrink-0 rounded-md border border-white/25 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white"
            >
              {showDiag ? "Hide" : "Details"}
            </button>
          </div>

          {showDiag && diag && (
            <div className="max-h-[45%] overflow-auto bg-black/70 p-3">
              <pre className="whitespace-pre-wrap break-all font-mono text-[0.62rem] leading-relaxed text-white/90">
                {diagText(diag)}
              </pre>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(diagText(diag));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="mt-2 rounded-md border border-white/25 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-white"
              >
                {copied ? "Copied" : "Copy diagnostics"}
              </button>
            </div>
          )}

          <iframe
            src={url}
            title="PDF preview"
            className="h-full w-full flex-1 border-0 bg-white"
          />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="gradient-gold m-2 rounded-lg px-4 py-2 text-center text-xs font-bold text-white"
          >
            Open PDF in new tab
          </a>
        </div>
      )}
      {status === "ready" && pages > 0 && (
        <p className="pb-2 pt-1 text-center text-[0.65rem] uppercase tracking-widest text-white/70">
          {pages} page{pages > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
