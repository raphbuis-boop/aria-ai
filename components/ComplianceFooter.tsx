import {
  AGENT_LICENSE,
  AGENT_NAME,
  BROKERAGE_ADDRESS,
  BROKERAGE_LICENSE,
  BROKERAGE_NAME,
  BROKERAGE_PHONE,
  EQUAL_HOUSING_DISCLOSURE,
} from "@/lib/compliance";
import Link from "next/link";

export function ComplianceFooter() {
  const policyLinks = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/dmca", label: "DMCA" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/fair-housing", label: "Fair Housing" },
  ];

  return (
    <footer className="border-t border-border-card bg-bg-card/80 px-4 py-5 text-[12px] text-text-dim">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[16px] font-semibold text-text-primary md:text-[17px]">
            {BROKERAGE_NAME}
          </p>
          <p className="text-[12px] text-text-muted">Offered through Aria</p>
          <p>
            {AGENT_NAME} · License {AGENT_LICENSE}
          </p>
          <p>
            Brokerage license {BROKERAGE_LICENSE}
          </p>
          <p>
            {BROKERAGE_ADDRESS} · {BROKERAGE_PHONE}
          </p>
          <p className="pt-1 text-[11px]">{EQUAL_HOUSING_DISCLOSURE}</p>
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
