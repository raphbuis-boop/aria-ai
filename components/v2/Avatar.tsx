"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeClass: Record<AvatarSize, string> = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
};

/** Deterministic hue from name string */
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const label = name ? initials(name) : "?";
  const hue = name ? nameHue(name) : 220;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "avatar"}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeClass[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-label={name ?? "avatar"}
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0 font-semibold select-none",
        sizeClass[size],
        className,
      )}
      style={{
        background: `hsl(${hue} 40% 22%)`,
        color: `hsl(${hue} 60% 75%)`,
      }}
    >
      {label}
    </span>
  );
}
