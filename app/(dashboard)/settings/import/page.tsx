import { redirect } from "next/navigation";

/** Import moved to Clients → Import contacts; old links (and ?next=) still work. */
export default function OldImportPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(`/clients/import${qs ? `?${qs}` : ""}`);
}
