"use client";

import { AriaMark } from "@/components/auth/aria-mark";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ease = [0.2, 0.8, 0.2, 1] as const;

export default function EmailLoginPage() {
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
    <div className="relative isolate min-h-[100dvh] w-full bg-background text-foreground">
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[400px] flex-col px-6"
        style={{
          paddingTop: "max(2.75rem, calc(env(safe-area-inset-top) + 1.75rem))",
          paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease }}
          className="mb-8 flex flex-col items-center"
        >
          <Link href="/login" className="mb-5 transition hover:opacity-80" aria-label="Back to sign-in options">
            <AriaMark size={64} />
          </Link>
          <h1 className="font-heading text-[26px] text-foreground">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Log in with your email</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease, delay: 0.04 }}
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-1 flex-col space-y-4"
        >
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error ? <p className="text-[13px] text-destructive/90">{error}</p> : null}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: loading ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
            className="mt-2 w-full rounded-[8px] bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-55"
          >
            {loading ? "Signing in…" : "Log in"}
          </motion.button>

          <p className="pt-6 text-center text-[13px] text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-primary">
              Sign up
            </Link>
            {" · "}
            <Link href="/login" className="font-semibold text-primary">
              Other options
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
