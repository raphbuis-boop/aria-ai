import { PolicyLink, PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accessibility Statement | Aria",
  description: "Aria accessibility commitment and support contact.",
};

export default async function AccessibilityPage() {
  const profile = await getComplianceProfileServer();
  const supportEmail = profile.supportEmail;

  return (
    <PolicyPage
      title="Accessibility Statement"
      subtitle="Our commitment to accessible digital experiences."
    >
      <PolicySection heading="Commitment">
        <p>
          Aria is committed to providing an accessible website and product experience for all
          users. We work toward conformance with WCAG 2.1 Level AA standards.
        </p>
      </PolicySection>

      <PolicySection heading="Ongoing improvements">
        <p>
          Accessibility is an ongoing effort. We regularly review product interfaces and content
          to improve keyboard navigation, contrast, semantic structure, and assistive technology
          support.
        </p>
      </PolicySection>

      <PolicySection heading="Contact for accessibility issues">
        {supportEmail ? (
          <p>
            If you encounter accessibility barriers, email{" "}
            <PolicyLink href={`mailto:${supportEmail}`}>{supportEmail}</PolicyLink> with details
            so we can investigate and address the issue.
          </p>
        ) : (
          <p>
            If you encounter accessibility barriers, reach us via our{" "}
            <PolicyLink href="/contact">Contact</PolicyLink> page with details so we can
            investigate and address the issue.
          </p>
        )}
      </PolicySection>
    </PolicyPage>
  );
}
