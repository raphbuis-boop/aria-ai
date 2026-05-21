"use client";

import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";

/**
 * Renders a PDF inline via the browser's native PDF viewer (iframe /
 * <object>). This avoids the Next.js + react-pdf + pdfjs-worker compatibility
 * issues that previously made the signing page blank on mobile. Every modern
 * desktop browser and iOS/Android Chrome handles this inline. If the browser
 * can't render PDFs inline (Safari on iOS sometimes won't), we fall back to a
 * prominent "Open PDF" link so the client can still read the agreement before
 * signing below.
 */
export function BbaPdfViewer({
  url,
  width,
}: {
  url: string;
  width: number;
}) {
  const [failed, setFailed] = useState(false);
  const height = Math.max(420, Math.min(640, Math.round(width * 1.3)));

  if (failed) {
    return (
      <PdfFallback url={url} />
    );
  }

  return (
    <div className="w-full">
      <object
        data={url}
        type="application/pdf"
        width="100%"
        height={height}
        onError={() => setFailed(true)}
        className="block w-full rounded-[10px] bg-white"
      >
        {/* If the browser can't render PDFs inline, this inner content shows. */}
        <PdfFallback url={url} />
      </object>
    </div>
  );
}

function PdfFallback({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border-[0.5px] border-[#1e2230] bg-[#0a0a15] p-4 text-[12.5px] text-[#b6b6c8]">
      <p>
        Your browser can&apos;t display the PDF inline. Tap below to open the
        agreement in a new tab, then come back here to sign.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#3a65f0] to-[#7c5cfc] px-3 py-2 text-[12px] font-semibold text-white"
        >
          <ExternalLink size={12} /> Open agreement
        </a>
        <a
          href={url}
          download
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[0.5px] border-[#2a2e40] px-3 py-2 text-[12px] font-semibold text-[#9090a8]"
        >
          <Download size={12} /> Download
        </a>
      </div>
    </div>
  );
}

export default BbaPdfViewer;
