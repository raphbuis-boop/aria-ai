"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { registerAgent } from "./actions";

const ease = [0.2, 0.8, 0.2, 1] as const;

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
    <div
      className="flex min-h-[100dvh] flex-col bg-bg-primary px-4"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <motion.form
        action={action}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease }}
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-4"
      >
        {/* Card */}
        <div className="flex-1 rounded-[16px] border border-border-card bg-bg-card p-8">
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
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[16px] text-text-primary outline-none transition-colors focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
              >
                <option value="NJ">New Jersey (NJ)</option>
              </select>
            </div>
            <Input name="fullName" required placeholder="Full name" />
            <Input name="email" type="email" required placeholder="Email" />
            <Input name="password" type="password" required placeholder="Password" />
            <Input name="confirm" type="password" required placeholder="Confirm password" />
          </div>
          {error ? (
            <p className="mt-4 text-[13px] text-accent-red">{error}</p>
          ) : null}
        </div>

        {/* CTA — pinned to bottom of the flex column */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[8px] bg-accent-blue py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </motion.form>
    </div>
  );
}
