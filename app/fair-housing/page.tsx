import { PolicyPage, PolicySection } from "@/components/policy/policy-shell";
import { EQUAL_HOUSING_DISCLOSURE, getComplianceProfileServer } from "@/lib/compliance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fair Housing Statement | Aria",
  description: "Fair Housing and Equal Housing Opportunity statement.",
};

export default async function FairHousingPage() {
  const profile = await getComplianceProfileServer();

  return (
    <PolicyPage title="Fair Housing Statement" subtitle="Equal Housing Opportunity commitment.">
      <PolicySection heading="Equal Housing Opportunity">
        <p>{profile.fairHousingStatement || EQUAL_HOUSING_DISCLOSURE}</p>
      </PolicySection>

      <PolicySection heading="Federal Fair Housing Act">
        <p>
          We support the Federal Fair Housing Act, which prohibits discrimination in housing
          based on race, color, religion, sex, disability, familial status, or national origin.
        </p>
      </PolicySection>

      <PolicySection heading="New Jersey Law Against Discrimination">
        <p>
          We also comply with the New Jersey Law Against Discrimination (NJLAD), including
          applicable protections related to housing and real estate services.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
