"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Load the pdfjs worker from a CDN pinned to the bundled pdfjs version.
// This avoids Next.js webpack having to bundle the worker.
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export function BbaPdfViewer({
  url,
  width,
}: {
  url: string;
  width: number;
}) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNumPages(0);
    setError(null);
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Document
        file={url}
        onLoadSuccess={(info) => setNumPages(info.numPages)}
        onLoadError={(err) => setError(err.message)}
        loading={
          <div className="py-8 text-[12px] text-[#888898]">Loading PDF…</div>
        }
      >
        {Array.from({ length: numPages }).map((_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-lg mb-3 rounded-[6px] overflow-hidden"
          />
        ))}
      </Document>
      {error ? (
        <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-400">
          Could not load PDF: {error}. You can still sign using the form below.
        </div>
      ) : null}
    </div>
  );
}

export default BbaPdfViewer;
