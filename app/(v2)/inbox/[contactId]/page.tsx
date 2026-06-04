/**
 * v2 Inbox thread — Phase 1 stub
 */
export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  return (
    <div className="px-4 pt-12">
      <p className="text-sm text-[#5E6068]">
        Inbox thread for {contactId} — coming Phase 2
      </p>
    </div>
  );
}
