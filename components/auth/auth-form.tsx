"use client";

import { BORDER, GREEN, INK, MUTED } from "@/components/auth/auth-shell";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

const fieldStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${BORDER}`,
  color: INK,
  borderRadius: 12,
  padding: "13px 16px",
  fontSize: 15,
  outline: "none",
  width: "100%",
};

export function AuthField({ label, id: idProp, style, ...props }: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium" style={{ color: INK }}>
        {label}
      </label>
      <input id={id} style={{ ...fieldStyle, ...style }} {...props} />
    </div>
  );
}

export function AuthPasswordField({
  label,
  id: idProp,
  forgotPasswordHref,
  ...props
}: FieldProps & { forgotPasswordHref?: string }) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium" style={{ color: INK }}>
          {label}
        </label>
        {forgotPasswordHref ? (
          <Link href={forgotPasswordHref} className="text-[12px] font-semibold hover:opacity-70" style={{ color: GREEN }}>
            Forgot password?
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} style={{ ...fieldStyle, paddingRight: 44 }} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3.5 transition hover:opacity-70"
          style={{ color: MUTED }}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const busy = props.disabled || loading;
  return (
    <motion.button
      {...props}
      disabled={busy}
      whileTap={{ scale: busy ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
      className="mt-2 w-full py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
      style={{ background: GREEN, borderRadius: 12 }}
    >
      {children}
    </motion.button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.8 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

export function AuthGoogleButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const busy = props.disabled;
  return (
    <motion.button
      type="button"
      {...props}
      whileTap={{ scale: busy ? 1 : 0.97, transition: { type: "tween", duration: 0.1 } }}
      className="flex w-full items-center justify-center gap-2.5 py-3.5 text-[15px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45"
      style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK, borderRadius: 12 }}
    >
      <GoogleIcon />
      {children}
    </motion.button>
  );
}
