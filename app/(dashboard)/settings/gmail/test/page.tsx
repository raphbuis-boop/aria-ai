"use client";

import { useState } from "react";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TestResult {
  ok: boolean;
  emailAddress?: string;
  sample?: {
    id: string | null;
    threadId: string | null;
    snippet: string | null;
    from: string | null;
    to: string | null;
    subject: string | null;
    date: string | null;
  } | null;
  note?: string;
  error?: string;
  code?: string;
  message?: string;
}

export default function GmailTestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/gmail/test");
      const data = (await res.json()) as TestResult;
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <BackButton href="/settings" className="mb-4" />
      <h1 className="text-[20px] font-medium text-text-primary">
        Test Gmail Connection
      </h1>
      <p className="mt-2 text-[13px] text-text-dim">
        Runs a read-only test: fetches metadata for a single recent message
        from your Gmail account. Nothing is stored.
      </p>

      <button
        type="button"
        onClick={runTest}
        disabled={running}
        className="mt-5 rounded-[8px] bg-accent-blue px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {running ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Testing…
          </span>
        ) : (
          "Run test"
        )}
      </button>

      {result ? (
        <div
          className={
            "mt-5 rounded-[14px] border p-4 " +
            (result.ok
              ? "border-green-500/30 bg-green-500/5"
              : "border-red-500/30 bg-red-500/5")
          }
        >
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            {result.ok ? (
              <>
                <CheckCircle2 size={14} className="text-green-400" />
                <span className="text-green-300">Connection OK</span>
              </>
            ) : (
              <>
                <XCircle size={14} className="text-red-400" />
                <span className="text-red-300">
                  {result.code === "not_connected"
                    ? "Not connected"
                    : result.code === "not_configured"
                      ? "OAuth not configured"
                      : "Failed"}
                </span>
              </>
            )}
          </div>

          {result.emailAddress ? (
            <div className="text-[12px] text-text-secondary">
              Connected as{" "}
              <span className="font-mono">{result.emailAddress}</span>
            </div>
          ) : null}

          {result.note ? (
            <div className="mt-2 text-[12px] text-text-dim">{result.note}</div>
          ) : null}

          {result.sample ? (
            <div className="mt-3 space-y-1 text-[12px]">
              <div className="text-text-dim">Most recent message:</div>
              <div className="text-white">
                <span className="text-text-dim">From:</span> {result.sample.from}
              </div>
              <div className="text-white">
                <span className="text-text-dim">Subject:</span>{" "}
                {result.sample.subject}
              </div>
              <div className="text-white">
                <span className="text-text-dim">Date:</span> {result.sample.date}
              </div>
              {result.sample.snippet ? (
                <div className="mt-2 rounded-[8px] border border-border-card bg-bg-deep p-2 italic text-text-secondary">
                  {result.sample.snippet}
                </div>
              ) : null}
            </div>
          ) : null}

          {result.error || result.message ? (
            <div className="mt-2 text-[12px] text-red-300">
              {result.message ?? result.error}
            </div>
          ) : null}

          {result.code === "not_connected" ? (
            <div className="mt-2 text-[12px] text-text-secondary">
              <Link href="/settings" className="text-accent-blue underline">
                Go to Settings → Connect Gmail
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
