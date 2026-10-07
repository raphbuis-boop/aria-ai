"use client";

import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewListingPage() {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    address: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [suite, setSuite] = useState<Record<string, string> | null>(null);
  const [buyers, setBuyers] = useState<{ id: string; name: string }[]>([]);

  async function uploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/listings/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("files").upload(path, file);
      if (error) {
        toast.toast(error.message, "warn");
        continue;
      }
      const { data: pub } = supabase.storage.from("files").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    setPhotos((p) => [...p, ...urls]);
    toast.toast("Photos uploaded", "success");
  }

  async function generateSuite() {
    const res = await fetch("/api/ai/listing-narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address,
        price: Number(form.price),
        beds: Number(form.beds),
        baths: Number(form.baths),
        sqft: Number(form.sqft),
      }),
    });
    const data = await res.json();
    setSuite(data);
  }

  async function saveListing() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("listings").insert({
      agent_id: user.id,
      address: form.address,
      price: Number(form.price),
      beds: Number(form.beds),
      baths: Number(form.baths),
      sqft: Number(form.sqft),
      description: suite?.mls_description ?? "",
      mls_description: suite?.mls_description ?? "",
      instagram_captions: {
        funny: suite?.instagram_funny,
        professional: suite?.instagram_professional,
        teaser: suite?.instagram_teaser,
      },
      sms_blast: suite?.sms_blast ?? "",
      photos,
    });
    toast.toast("Listing saved", "success");
    router.push("/listings");
  }

  async function findBuyers() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const price = Number(form.price);
    const beds = Number(form.beds);
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("agent_id", user.id)
      .gte("budget_max", price * 0.9)
      .lte("beds_wanted", beds);
    setBuyers((data as { id: string; name: string }[]) ?? []);
  }

  async function aiTextBuyer(id: string, name: string) {
    await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        clientName: name,
        propertyContext: `${form.address} at $${form.price}`,
        skipInsert: false,
      }),
    });
    toast.toast("Draft created", "success");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-foreground">
        New Listing
      </div>
      <div className="mt-2 text-[12px] text-muted-foreground">Step {step} of 3</div>
      <MarketsComingSoonNote className="mt-2" />

      {step === 1 ? (
        <div className="mt-4 space-y-2">
          {(
            [
              ["address", "Address"],
              ["price", "Price"],
              ["beds", "Beds"],
              ["baths", "Baths"],
              ["sqft", "Sqft"],
            ] as const
          ).map(([k, ph]) => (
            <input
              key={k}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              placeholder={ph}
              aria-label={ph}
              className="w-full rounded-[8px] border border-border bg-secondary px-3 py-2 text-[13px]"
            />
          ))}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-2 w-full rounded-[8px] bg-primary py-2 text-[13px] text-primary-foreground"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4">
          <label className="inline-block rounded-[8px] bg-primary px-3 py-2 text-[12px] text-primary-foreground">
            Upload photos
            <input type="file" multiple className="hidden" onChange={uploadPhotos} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={p} alt="" className="h-16 w-16 rounded-[8px] object-cover" />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-4 w-full rounded-[8px] bg-primary py-2 text-[13px] text-primary-foreground"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={generateSuite}
            className="w-full rounded-[8px] bg-primary py-2 text-[13px] text-primary-foreground"
          >
            Generate Marketing Suite
          </button>
          {suite ? (
            <div className="space-y-3">
              <div className="rounded-[14px] border border-border bg-card p-3 text-[13px] text-foreground/75">
                <div className="text-[11px] text-muted-foreground">Listing description</div>
                {suite.mls_description}
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(suite.mls_description)
                      .then(() => toast.toast("Copied", "success"))
                  }
                  className="mt-2 rounded-[8px] border border-border px-2 py-1 text-[11px] text-primary"
                >
                  Copy
                </button>
              </div>
              {["instagram_funny", "instagram_professional", "instagram_teaser"].map(
                (k) => (
                  <div
                    key={k}
                    className="rounded-[14px] border border-border bg-card p-3 text-[13px]"
                  >
                    {String(suite[k] ?? "")}
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(String(suite[k] ?? ""))
                          .then(() => toast.toast("Copied", "success"))
                      }
                      className="mt-2 rounded-[8px] border border-border px-2 py-1 text-[11px] text-primary"
                    >
                      Copy
                    </button>
                  </div>
                ),
              )}
              <div className="rounded-[14px] border border-border bg-card p-3 text-[13px]">
                {suite.sms_blast}
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(suite.sms_blast)
                      .then(() => toast.toast("Copied", "success"))
                  }
                  className="mt-2 rounded-[8px] border border-border px-2 py-1 text-[11px] text-primary"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={saveListing}
            className="w-full rounded-[8px] border border-border py-2 text-[13px] text-primary"
          >
            Save listing
          </button>
          <button
            type="button"
            onClick={findBuyers}
            className="w-full rounded-[8px] bg-secondary py-2 text-[13px] text-foreground/75"
          >
            Find Matching Buyers
          </button>
          <div className="space-y-2">
            {buyers.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2"
              >
                <span className="text-[13px]">{b.name}</span>
                <button
                  type="button"
                  onClick={() => aiTextBuyer(b.id, b.name)}
                  className="rounded-[8px] bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                >
                  AI Text
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
