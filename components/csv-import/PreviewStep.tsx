"use client";

import { formatPhoneE164 } from "@/lib/utils";
import { X } from "lucide-react";
import { type PreviewRow } from "./utils";

type Props = {
  rows: PreviewRow[];
  onUpdateRows: (updated: PreviewRow[]) => void;
  onBack: () => void;
  onImport: () => void;
  importing: boolean;
};

function phonePreview(raw: string): { display: string; valid: boolean } {
  if (!raw.trim()) return { display: "—", valid: true };
  const e164 = formatPhoneE164(raw);
  if (e164) return { display: e164, valid: true };
  return { display: raw, valid: false };
}

export function PreviewStep({ rows, onUpdateRows, onBack, onImport, importing }: Props) {
  const active = rows.filter((r) => !r._deleted);
  const nameErrors = active.filter((r) => !r.name.trim()).length;
  const phoneWarnings = active.filter(
    (r) => r.phone.trim() && !formatPhoneE164(r.phone),
  ).length;

  function updateRow(id: string, patch: Partial<PreviewRow>) {
    onUpdateRows(rows.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }

  function deleteRow(id: string) {
    onUpdateRows(rows.map((r) => (r._id === id ? { ...r, _deleted: true } : r)));
  }

  const canImport = active.length > 0 && nameErrors === 0;

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Chip label={`${active.length} to import`} color="var(--primary)" />
        {rows.length - active.length > 0 && (
          <Chip label={`${rows.length - active.length} removed`} color="var(--muted-foreground)" />
        )}
        {nameErrors > 0 && (
          <Chip label={`${nameErrors} missing name`} color="var(--destructive)" />
        )}
        {phoneWarnings > 0 && (
          <Chip label={`${phoneWarnings} invalid phone`} color="var(--warm)" />
        )}
      </div>

      {/* Scrollable table */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: 340,
          border: "1px solid var(--border)",
          borderRadius: 10,
          fontSize: 12,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ background: "var(--secondary)" }}>
              {["Name", "Phone", "Email", "Type", "Budget max", "Town", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    color: "var(--muted-foreground)",
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row._deleted) return null;
              const nameErr = !row.name.trim();
              const ph = phonePreview(row.phone);

              return (
                <tr
                  key={row._id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: nameErr ? "color-mix(in srgb, var(--destructive) 12%, transparent)" : "transparent",
                  }}
                >
                  {/* Name */}
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row._id, { name: e.target.value })}
                      placeholder="Required"
                      style={{
                        background: "transparent",
                        border: `0.5px solid ${nameErr ? "color-mix(in srgb, var(--destructive) 12%, transparent)" : "var(--secondary)"}`,
                        borderRadius: 6,
                        color: nameErr ? "var(--destructive)" : "var(--foreground)",
                        fontSize: 13,
                        padding: "4px 8px",
                        width: 130,
                        outline: "none",
                      }}
                    />
                  </td>
                  {/* Phone */}
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      style={{
                        color: ph.valid ? "var(--muted-foreground)" : "var(--warm)",
                        fontFamily: "monospace",
                        fontSize: 12,
                      }}
                    >
                      {ph.display}
                    </span>
                  </td>
                  {/* Email */}
                  <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.email || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                  </td>
                  {/* Type */}
                  <td style={{ padding: "6px 8px" }}>
                    <select
                      value={row.client_role.toLowerCase() === "seller" ? "seller" : "buyer"}
                      onChange={(e) => updateRow(row._id, { client_role: e.target.value })}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--foreground)",
                        fontSize: 12,
                        padding: "3px 6px",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </td>
                  {/* Budget max */}
                  <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {row.budget_max || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                  </td>
                  {/* Town */}
                  <td style={{ padding: "6px 8px", color: "var(--muted-foreground)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.town || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                  </td>
                  {/* Delete */}
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      type="button"
                      onClick={() => deleteRow(row._id)}
                      aria-label="Remove row"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "var(--muted-foreground)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nameErrors > 0 && (
        <p style={{ color: "var(--destructive)", fontSize: 12, marginTop: 8 }}>
          Rows with a missing name will be skipped. Fill them in or remove them.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={importing}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 9,
            color: "var(--muted-foreground)",
            fontSize: 14,
            fontWeight: 500,
            padding: "12px 16px",
            cursor: importing ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={!canImport || importing}
          style={{
            flex: 1,
            background: !canImport || importing ? "var(--secondary)" : "var(--primary)",
            border: "none",
            borderRadius: 9,
            color: !canImport || importing ? "var(--muted-foreground)" : "var(--primary-foreground)",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 16px",
            cursor: !canImport || importing ? "not-allowed" : "pointer",
            transition: "background 120ms ease",
          }}
        >
          {importing ? "Importing…" : `Import ${active.length} client${active.length !== 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        background: `${color}18`,
        color,
        border: `0.5px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}
