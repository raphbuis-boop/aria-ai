"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContactImporter } from "@/components/import/ContactImporter";

export function ImportContactsClient({ next, fromGoogleConnect }: { next: string | null; fromGoogleConnect: boolean }) {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] bg-background pb-[130px] text-foreground">
      <div className="mx-auto max-w-xl px-5 pt-8 sm:px-8">
        <Link href="/clients" className="mb-5 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-muted-foreground">
          <ArrowLeft className="size-3.5" /> Clients
        </Link>
        <h1 className="font-heading text-[34px] leading-tight text-foreground">Import contacts</h1>
        <p className="mb-6 mt-1 font-display text-body text-muted-foreground">
          Bring in the people you know. Nobody gets a text — you decide who to reach out to.
        </p>
        <ContactImporter
          returnTo="import"
          // Back from the Google connect round-trip: go straight to the contact list.
          initialMethod={fromGoogleConnect ? "google" : undefined}
          doneLabel={next ? "Continue →" : "See your clients →"}
          onDone={() => {
            // Imported clients change Today and Follow-ups — skip the router's cached copy.
            router.push(next ?? "/clients");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
