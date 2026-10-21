import { ImportContactsClient } from "./import-client";

export const dynamic = "force-dynamic";

/** Clients → Import contacts: Google, a file, a pasted list, or (in the iOS app) the phone. */
export default function ImportContactsPage({ searchParams }: { searchParams: { next?: string; gmail?: string } }) {
  // Only same-site paths are honored for ?next= (e.g. back into onboarding).
  const next = searchParams.next?.startsWith("/") && !searchParams.next.startsWith("//") ? searchParams.next : null;
  return <ImportContactsClient next={next} fromGoogleConnect={Boolean(searchParams.gmail)} />;
}
