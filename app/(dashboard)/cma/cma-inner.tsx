"use client";

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
      .from("market_data")
      .select("*")
      .eq("town", form.town)
      .maybeSingle();
    const res = await fetch("/api/ai/cma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address,
        town: form.town,
        beds: Number(form.beds),
        baths: Number(form.baths),
        sqft: Number(form.sqft),
        priceMin: Number(form.priceMin),
        priceMax: Number(form.priceMax),
        sellerName: form.sellerName,
        marketStats: md ?? {},
      }),
    });
    const data = await res.json();
    setSlides(data.slides ?? []);
    setTextCopy(
      (data.slides ?? [])
        .map(
          (s: Slide) =>
            `${s.title}\n${s.subtitle}\n${s.content}\n${s.highlight}\n`,
        )
        .join("\n---\n"),
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
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">
        Pitch Deck Generator
      </div>
      <p className="mt-2 text-[13px] text-text-dim">
        Win your next listing presentation.
      </p>
      <div className="mt-4 space-y-2">
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
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={generate}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-3 text-[13px] font-medium text-white"
      >
        Generate Pitch Deck
      </button>

      <div ref={deckRef} className="mt-6 space-y-3">
        {slides.map((s, i) => (
          <div
            key={i}
            className="rounded-[14px] border border-border-card bg-bg-card p-4"
          >
            <div className="text-[16px] font-medium text-accent-blue">{s.title}</div>
            <div className="text-[12px] text-text-dim">{s.subtitle}</div>
            <p className="mt-2 text-[13px] text-text-secondary">{s.content}</p>
            <div className="mt-2 text-[12px] font-medium text-accent-blue">
              {s.highlight}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={downloadPdf}
          className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(textCopy).then(() =>
              toast.toast("Copied", "success"),
            )
          }
          className="flex-1 rounded-[8px] border border-border-card py-2 text-[13px] text-accent-blue"
        >
          Copy as Text
        </button>
      </div>
    </div>
  );
}
