import { useEffect, useRef, useState } from "react";

// pdf.js worker (Vite-friendly, with CDN fallback)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | null = null;
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
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
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

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setStatus("loading");

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPages(pdf.numPages);

        const containerWidth = container.clientWidth - 16; // padding allowance
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
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
          if (!ctx) continue;
          ctx.scale(dpr, dpr);

          const wrap = document.createElement("div");
          wrap.className = "mb-3 flex justify-center";
          wrap.appendChild(canvas);
          container.appendChild(wrap);

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("PDF render failed", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

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
