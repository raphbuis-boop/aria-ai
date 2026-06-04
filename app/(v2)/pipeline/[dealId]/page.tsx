/**
 * v2 Pipeline deal detail — Phase 1 stub
 */
export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return (
    <div className="px-4 pt-12">
      <p className="text-sm text-[#5E6068]">
        Deal {dealId} — coming Phase 2
      </p>
    </div>
  );
}
