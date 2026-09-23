"use client";

import { ALL_ARIA_FIELDS, ARIA_FIELD_LABELS, type AriaField, type FieldMapping } from "./utils";

type Props = {
  mapping: FieldMapping[];
  filename: string;
  rowCount: number;
  onUpdateMapping: (updated: FieldMapping[]) => void;
  onBack: () => void;
  onContinue: () => void;
  loading: boolean;
};

export function MappingStep({
  mapping,
  filename,
  rowCount,
  onUpdateMapping,
  onBack,
  onContinue,
  loading,
}: Props) {
  const highCount = mapping.filter((m) => m.confidence === "high" && m.field !== "skip").length;
  const activeCount = mapping.filter((m) => m.field !== "skip").length;

  function updateField(index: number, field: AriaField) {
    const updated = [...mapping];
    updated[index] = { ...updated[index], field };
    onUpdateMapping(updated);
  }

  return (
    <div>
      {/* File info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "10px 14px",
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </p>
          <p style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 2 }}>
            {rowCount} rows · {activeCount} columns mapped · {highCount} high-confidence
          </p>
        </div>
      </div>

      <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        Aria mapped your columns automatically.{" "}
        <span style={{ color: "var(--primary)" }}>●</span> Green = confident,{" "}
        <span style={{ color: "var(--warm)" }}>●</span> yellow = review.
        Change any mapping using the dropdown.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
        {mapping.map((m, i) => (
          <div
            key={m.header}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: 9,
            }}
          >
            {/* Confidence dot */}
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                background: m.field === "skip"
                  ? "var(--muted-foreground)"
                  : m.confidence === "high"
                    ? "var(--primary)"
                    : "var(--warm)",
              }}
            />
            {/* CSV header label */}
            <span
              style={{
                color: m.field === "skip" ? "var(--muted-foreground)" : "var(--foreground)",
                fontSize: 13,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.header}
            </span>
            {/* Arrow */}
            <span style={{ color: "var(--muted-foreground)", fontSize: 12, flexShrink: 0 }}>→</span>
            {/* Field selector */}
            <select
              value={m.field}
              onChange={(e) => updateField(i, e.target.value as AriaField)}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: m.field === "skip" ? "var(--muted-foreground)" : "var(--foreground)",
                fontSize: 12,
                padding: "5px 8px",
                cursor: "pointer",
                outline: "none",
                maxWidth: 160,
                flexShrink: 0,
              }}
            >
              {ALL_ARIA_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {ARIA_FIELD_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 9,
            color: "var(--muted-foreground)",
            fontSize: 14,
            fontWeight: 500,
            padding: "12px 16px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={loading || activeCount === 0}
          style={{
            flex: 1,
            background: loading || activeCount === 0 ? "var(--secondary)" : "var(--primary)",
            border: "none",
            borderRadius: 9,
            color: loading || activeCount === 0 ? "var(--muted-foreground)" : "var(--primary-foreground)",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 16px",
            cursor: loading || activeCount === 0 ? "not-allowed" : "pointer",
            transition: "background 120ms ease",
          }}
        >
          {loading ? "Building preview…" : `Preview ${rowCount} rows →`}
        </button>
      </div>
    </div>
  );
}
