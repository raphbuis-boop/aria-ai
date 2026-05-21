"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({
  href,
  label = "Back",
  className = "",
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    if (href) {
      router.push(href);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-[#3a65f0] text-sm font-semibold ${className}`}
    >
      <ChevronLeft size={18} strokeWidth={2.5} className="-ml-1" />
      <span>{label}</span>
    </button>
  );
}
