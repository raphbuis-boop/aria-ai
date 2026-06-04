"use client";

import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

type Slide = {
  title: string;
  subtitle: string;
  content: string;
  highlight: string;
};

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

export function CmaInner() {
  const toast = useToast();
  const search = useSearchParams();
  const seller = search.get("seller") ?? "";
  const deckRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    address: "",
    town: "Ridgewood",
    beds: "4",
    baths: "2.5",
    sqft: "2400",
    priceMin: "800000",
    priceMax: "950000",
    sellerName: seller || "Seller",
  });
  const [slides, setSlides] = useState<Slide[]>([]);
  const [textCopy, setTextCopy] = useState("");

  async function generate() {
    const supabase = createClient();
    const { data: md } = await supabase
      .from("market_data").select("*").eq("town", form.town).maybeSingle();
    const res = await fetch("/api/ai/cma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address, town: form.town,
        beds: Number(form.beds), baths: Number(form.baths),
        sqft: Number(form.sqft), priceMin: Number(form.priceMin),
        priceMax: Number(form.priceMax), sellerName: form.sellerName,
        marketStats: md ?? {},
      }),
    });
    const data = await res.json();
    setSlides(data.slides ?? []);
    setTextCopy(
      (data.slides ?? []).map(
        (s: Slide) => `${s.title}\n${s.subtitle}\n${s.content}\n${s.highlight}\n`,
      ).join("\n---\n"),
    );
  }

  async function downloadPdf() {
    if (!deckRef.current) return;
    const canvas = await html2canvas(deckRef.current);
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, w, h);
    pdf.save("aria-pitch-deck.pdf");
    toast.toast("PDF downloaded", "success");
  }

  return (
    <div
      className="min-h-[100dvh] pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
          #000000
        `,
        color: "#ffffff",
      }}
    >
      <div className="mx-auto max-w-lg px-5 pt-6">

        {/* ── Header ── */}
        <h1
          className="text-[22px] font-semibold leading-tight"
          style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
        >
          Pitch Deck Generator
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
          Win your next listing presentation.
        </p>
        <MarketsComingSoonNote className="mt-3 mb-5" />

        {/* ── Form ── */}
        <div className="space-y-2.5">
          {(
            [
              ["address", "Address"],
              ["town", "Town"],
              ["beds", "Beds"],
              ["baths", "Baths"],
              ["sqft", "Sqft"],
              ["priceMin", "Price min"],
              ["priceMax", "Price max"],
              ["sellerName", "Seller name"],
            ] as const
          ).map(([k, ph]) => (
            <input
              key={k}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              placeholder={ph}
              className="placeholder-[#4B5563]"
              style={INPUT_STYLE}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={generate}
          className="mt-4 w-full text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
          style={{ background: "#3B82F6", borderRadius: 8, padding: "13px" }}
        >
          Generate Pitch Deck
        </button>

        {/* ── Slide deck ── */}
        <div ref={deckRef} className="mt-6 space-y-3">
          {slides.map((s, i) => (
            <div
              key={i}
              style={{
                background: "rgba(20,20,22,0.7)",
                border: "0.5px solid rgba(255,255,255,0.06)",
                borderRadius: 18,
                padding: 18,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <div
                className="text-[16px] font-semibold"
                style={{ color: "#3B82F6", letterSpacing: "-0.01em" }}
              >
                {s.title}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>
                {s.subtitle}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#9CA3AF" }}>
                {s.content}
              </p>
              <div className="mt-2 text-[12px] font-semibold" style={{ color: "#3B82F6" }}>
                {s.highlight}
              </div>
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        {slides.length > 0 && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={downloadPdf}
              className="flex-1 text-[13px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
              style={{ background: "#3B82F6", borderRadius: 8, padding: "11px" }}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(textCopy).then(() => toast.toast("Copied", "success"))
              }
              className="flex-1 text-[13px] font-medium active:scale-[0.97] transition-transform duration-100"
              style={{
                background: "transparent",
                border: "0.5px solid rgba(255,255,255,0.15)",
                color: "#9CA3AF",
                borderRadius: 8,
                padding: "11px",
              }}
            >
              Copy as Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
