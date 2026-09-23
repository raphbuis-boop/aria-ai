"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseCSV, type ParsedCSV } from "./utils";

type Props = {
  onFile: (csv: ParsedCSV, filename: string) => void;
};

export function UploadStep({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        setError("Please upload a .csv file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (!parsed.headers.length) {
          setError("CSV appears to be empty or has no headers.");
          return;
        }
        if (!parsed.rows.length) {
          setError("No data rows found. Make sure the file has content below the header row.");
          return;
        }
        if (parsed.rows.length > 500) {
          setError(`This file has ${parsed.rows.length} rows. Maximum is 500 per import.`);
          return;
        }
        onFile(parsed, file.name);
      };
      reader.onerror = () => setError("Failed to read file. Try again.");
      reader.readAsText(file);
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragging ? "var(--primary)" : "var(--secondary)"}`,
          borderRadius: 14,
          padding: "52px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
          transition: "border-color 120ms ease, background 120ms ease",
          outline: "none",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Upload size={20} color="var(--primary)" />
        </div>
        <p style={{ color: "var(--foreground)", fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
          Drop your CSV here
        </p>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
          or tap to browse — .csv only, max 500 rows
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            // Reset so same file can be re-selected
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p
          style={{
            color: "var(--destructive)",
            fontSize: 13,
            marginTop: 10,
            padding: "8px 12px",
            background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          {error}
        </p>
      )}

      {/* Format hint */}
      <div
        style={{
          marginTop: 20,
          padding: "12px 14px",
          background: "var(--secondary)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <p style={{ color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.6 }}>
          <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>Supported columns:</span>{" "}
          First Name, Last Name, Email, Phone, Client Type, Budget, Town / Area, Notes, Source.
          Column headers don&apos;t need to match exactly — Aria will map them automatically.
        </p>
      </div>
    </div>
  );
}
