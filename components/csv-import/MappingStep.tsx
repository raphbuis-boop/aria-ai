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
          background: "rgba(58,101,240,0.06)",
          borderRadius: 10,
          border: "0.5px solid rgba(58,101,240,0.2)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#e8eaf2", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </p>
          <p style={{ color: "#6b7090", fontSize: 12, marginTop: 2 }}>
            {rowCount} rows · {activeCount} columns mapped · {highCount} high-confidence
          </p>
        </div>
      </div>

      <p style={{ color: "#9498b0", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        Aria mapped your columns automatically.{" "}
        <span style={{ color: "#10b981" }}>●</span> Green = confident,{" "}
        <span style={{ color: "#f59e0b" }}>●</span> yellow = review.
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
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.07)",
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
                  ? "#424560"
                  : m.confidence === "high"
                    ? "#10b981"
                    : "#f59e0b",
              }}
            />
            {/* CSV header label */}
            <span
              style={{
                color: m.field === "skip" ? "#6b7090" : "#e8eaf2",
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
            <span style={{ color: "#424560", fontSize: 12, flexShrink: 0 }}>→</span>
            {/* Field selector */}
            <select
              value={m.field}
              onChange={(e) => updateField(i, e.target.value as AriaField)}
              style={{
                background: "#0d0f16",
                border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 7,
                color: m.field === "skip" ? "#6b7090" : "#e8eaf2",
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
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 9,
            color: "#9498b0",
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
            background: loading || activeCount === 0 ? "#1e2230" : "#3a65f0",
            border: "none",
            borderRadius: 9,
            color: loading || activeCount === 0 ? "#6b7090" : "#ffffff",
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
