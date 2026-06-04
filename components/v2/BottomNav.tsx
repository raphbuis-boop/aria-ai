"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavDestination = {
  key: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  /** If true, renders the center FAB slot — no label, no standard tab styling */
  isFab?: boolean;
};

interface BottomNavProps {
  destinations: NavDestination[];
  className?: string;
}

export function BottomNav({ destinations, className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-40",
        "bg-[#141416]/90 backdrop-blur-md",
        "border-t border-[#2A2B30]",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="flex items-end h-[60px]">
        {destinations.map((dest) => {
          if (dest.isFab) {
            return (
              <div key={dest.key} className="flex-1 flex justify-center items-center pb-2">
                {/* FAB slot — rendered by parent via the ask route */}
                <Link
                  href={dest.href}
                  aria-label={dest.label}
                  className={cn(
                    "size-12 rounded-full bg-[#4F5BFF] flex items-center justify-center",
                    "shadow-lg shadow-[#4F5BFF]/30",
                    "transition-transform duration-[150ms] active:scale-95",
                  )}
                >
                  {dest.icon}
                </Link>
              </div>
            );
          }

          const isActive =
            dest.href === "/v2"
              ? pathname === "/v2" || pathname === "/v2/today"
              : pathname.startsWith(dest.href);

          return (
            <Link
              key={dest.key}
              href={dest.href}
              aria-label={dest.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-end gap-1 pb-2 pt-1",
                "transition-colors duration-[150ms]",
                isActive ? "text-[#E5E4E2]" : "text-[#5E6068]",
              )}
            >
              <span className="size-6 flex items-center justify-center">
                {isActive && dest.activeIcon ? dest.activeIcon : dest.icon}
              </span>
              <span className="text-[0.6rem] leading-none font-medium">{dest.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
