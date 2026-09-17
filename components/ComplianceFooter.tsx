"use client";

import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import type { ComplianceProfile } from "@/lib/compliance";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ComplianceFooter({
  includeIdxNotice = true,
}: {
  /** When false, brokerage + policies only (IDX block already on page). */
  includeIdxNotice?: boolean;
} = {}) {
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);

  useEffect(() => {
    void fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => {});
  }, []);

  const policyLinks = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/dmca", label: "DMCA" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/fair-housing", label: "Fair Housing" },
  ];

  const hasIdentity = profile?.legalName && profile?.licenseNumber && profile?.brokerageName;

  return (
    <footer className="border-t border-border-card bg-bg-card/80 px-4 py-5 text-[12px] text-text-dim">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <div className="space-y-2">
          {hasIdentity ? (
            <>
              <p className="text-[13px] text-text-primary">
                {profile.brokerageName}
              </p>
              <p className="text-[13px] text-text-primary">
                {profile.legalName}
                {profile.licenseState ? `, ${profile.licenseState}` : ""} License #{profile.licenseNumber}
              </p>
              {profile.businessAddress || profile.phone ? (
                <p className="text-[12px] text-text-dim">
                  {[profile.businessAddress, profile.phone].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </>
          ) : null}
          {includeIdxNotice ? (
            <div className="pt-2">
              <IdxComplianceNotice compact />
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Policies
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {policyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12px] text-text-dim hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
