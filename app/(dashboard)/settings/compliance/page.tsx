"use client";

import type { ComplianceProfile } from "@/lib/compliance";
import { REQUIRED_COMPLIANCE_FIELDS } from "@/lib/compliance";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FieldKey = keyof ComplianceProfile;

const FIELD_LABELS: Record<FieldKey, string> = {
  legalName: "Legal name",
  brokerageName: "Brokerage",
  licenseNumber: "License number",
  licenseState: "License state",
  phone: "Phone",
  email: "Email",
  businessAddress: "Business address",
  fairHousingStatement: "Fair Housing statement",
  supportEmail: "Support email",
  supportPhone: "Support phone",
  updatedAt: "Updated",
};

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase"
      style={{ color: "#6B7280", letterSpacing: "0.08em", marginLeft: 16 }}
    >
      {label}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(20,20,22,0.6)",
        borderRadius: 14,
        border: "0.5px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function FieldRow({
  field,
  value,
  required,
  placeholder,
  multiline,
  isLast,
  onSave,
}: {
  field: FieldKey;
  value: string;
  required: boolean;
  placeholder: string;
  multiline?: boolean;
  isLast?: boolean;
  onSave: (field: FieldKey, next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const empty = required && !draft.trim();

  return (
    <div
      className={multiline ? "flex flex-col gap-2" : "flex items-center justify-between gap-3"}
      style={{
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-[16px]" style={{ color: "#ffffff" }}>
        {FIELD_LABELS[field]}
        {required ? <span style={{ color: empty ? "#F59E0B" : "#4B5563" }}>*</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={draft}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() !== value.trim()) onSave(field, draft.trim());
          }}
          className="w-full resize-none rounded-lg bg-white/[0.04] p-2.5 text-[14px] outline-none"
          style={{ color: "#E5E7EB", border: "0.5px solid rgba(255,255,255,0.08)" }}
        />
      ) : (
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() !== value.trim()) onSave(field, draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none"
          style={{ color: "#E5E7EB" }}
        />
      )}
    </div>
  );
}

export default function ComplianceSettingsPage() {
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        setIsComplete(Boolean(d.isComplete));
      })
      .catch(() => {});
  }, []);

  async function saveField(field: FieldKey, value: string) {
    if (!profile) return;
    setProfile((p) => (p ? { ...p, [field]: value || null } : p));
    const res = await fetch("/api/compliance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error ?? "Couldn't save — try again");
      return;
    }
    setProfile(data);
    setIsComplete(Boolean(data.isComplete));
    setToast("Saved");
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!profile) {
    return (
      <div className="min-h-[100dvh] px-4 pt-6" style={{ color: "var(--oc-text-1)" }}>
        <p className="text-[13px]" style={{ color: "#6B7280" }}>
          Loading…
        </p>
      </div>
    );
  }

  const editableOrder: [FieldKey, boolean, string, boolean?][] = [
    ["legalName", true, "Your full legal name"],
    ["brokerageName", true, "Your brokerage's legal name"],
    ["licenseNumber", true, "e.g. 1234567"],
    ["licenseState", true, "e.g. NJ"],
    ["phone", true, "(555) 555-5555"],
    ["email", true, "you@example.com"],
    ["businessAddress", true, "Street, city, state, ZIP"],
    ["fairHousingStatement", false, "Defaults to standard Equal Housing Opportunity language if left blank", true],
    ["supportEmail", false, "support@yourdomain.com"],
    ["supportPhone", false, "(555) 555-5555"],
  ];

  return (
    <div className="min-h-[100dvh] pb-32" style={{ color: "var(--oc-text-1)" }}>
      {toast && (
        <div
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
          style={{
            top: "calc(env(safe-area-inset-top) + 12px)",
            background: "rgba(20,20,22,0.95)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {toast}
        </div>
      )}

      <div className="px-4 pt-6">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1 text-[14px]"
          style={{ color: "#9CA3AF" }}
        >
          <ChevronLeft size={16} /> Settings
        </Link>

        <h1 className="mb-1 text-[22px] font-bold" style={{ color: "#ffffff" }}>
          Compliance profile
        </h1>
        <p className="mb-5 text-[13px]" style={{ color: "#6B7280" }}>
          Shown publicly on your footer, IDX notices, and policy pages. Nothing here is invented —
          fields left blank simply won&apos;t appear on public pages until you fill them in.
        </p>

        {!isComplete && (
          <div
            className="mb-6 flex items-start gap-2.5 rounded-xl p-3.5"
            style={{ background: "rgba(245,158,11,0.1)", border: "0.5px solid rgba(245,158,11,0.3)" }}
          >
            <AlertTriangle size={18} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "#F59E0B" }}>
                Complete compliance profile
              </p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "#D6A24C" }}>
                {REQUIRED_COMPLIANCE_FIELDS.filter((f) => !profile[f]?.trim())
                  .map((f) => FIELD_LABELS[f])
                  .join(", ")}{" "}
                still {REQUIRED_COMPLIANCE_FIELDS.filter((f) => !profile[f]?.trim()).length === 1 ? "needs" : "need"} a value.
              </p>
            </div>
          </div>
        )}

        <GroupLabel label="Agent & brokerage" />
        <SettingsGroup>
          {editableOrder.slice(0, 7).map(([field, required, placeholder], i, arr) => (
            <FieldRow
              key={field}
              field={field}
              value={profile[field] ?? ""}
              required={required}
              placeholder={placeholder}
              onSave={(f, v) => void saveField(f, v)}
              isLast={i === arr.length - 1}
            />
          ))}
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        <GroupLabel label="Fair Housing statement" />
        <SettingsGroup>
          <FieldRow
            field="fairHousingStatement"
            value={profile.fairHousingStatement ?? ""}
            required={false}
            placeholder={editableOrder[7][2]}
            multiline
            onSave={(f, v) => void saveField(f, v)}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        <GroupLabel label="Support contact" />
        <SettingsGroup>
          {editableOrder.slice(8).map(([field, required, placeholder], i, arr) => (
            <FieldRow
              key={field}
              field={field}
              value={profile[field] ?? ""}
              required={required}
              placeholder={placeholder}
              onSave={(f, v) => void saveField(f, v)}
              isLast={i === arr.length - 1}
            />
          ))}
        </SettingsGroup>
      </div>
    </div>
  );
}
