import { ComplianceFooter } from "@/components/ComplianceFooter";

export default function PropertySearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ComplianceFooter includeIdxNotice={false} />
    </>
  );
}
