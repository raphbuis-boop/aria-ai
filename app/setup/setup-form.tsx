"use client";

import { useState } from "react";
import { registerAgent } from "./actions";

export function SetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function action(fd: FormData) {
    setError(null);
    setLoading(true);
    const res = await registerAgent(fd);
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <form
        action={action}
        className="w-full max-w-[420px] rounded-[16px] border border-border-card bg-bg-card p-8"
      >
        <h1 className="text-center text-[22px] font-medium text-accent-blue">
          Aria
        </h1>
        <p className="mt-2 text-center text-[13px] text-text-dim">
          Create your private account (invite-only)
        </p>
        <div className="mt-8 space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-text-dim">
              Your state
            </div>
            <select
              name="licenseState"
              defaultValue="NJ"
              className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary"
            >
              <option value="NJ">New Jersey (NJ)</option>
            </select>
          </div>
          <input
            name="fullName"
            required
            placeholder="Full name"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary"
          />
          <input
            name="confirm"
            type="password"
            required
            placeholder="Confirm password"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary"
          />
        </div>
        {error ? (
          <p className="mt-4 text-[13px] text-accent-amber">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-[8px] bg-accent-blue py-3 text-[14px] font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
