"use client";

import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-[380px] rounded-[16px] border border-border-card bg-bg-card p-8">
        <div className="text-center">
          <Image
            src="/aria-logo.png"
            alt="Aria"
            width={96}
            height={96}
            priority
            className="mx-auto mb-4"
          />
          <div className="text-[28px] font-medium text-accent-blue">Aria</div>
          <p className="mt-2 text-[13px] text-text-dim">
            Your AI real estate teammate
          </p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary placeholder:text-text-dim"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[14px] text-text-primary placeholder:text-text-dim"
          />
          {error ? (
            <p className="text-[13px] text-accent-amber">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[8px] bg-accent-blue py-3 text-[14px] font-medium text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
