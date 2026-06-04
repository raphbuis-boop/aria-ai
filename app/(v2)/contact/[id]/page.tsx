/**
 * v2 Contact detail — Phase 1 stub
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-4 pt-12">
      <p className="text-sm text-[#5E6068]">
        Contact {id} — coming Phase 2
      </p>
    </div>
  );
}
