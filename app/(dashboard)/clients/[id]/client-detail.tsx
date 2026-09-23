"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Pill } from "@/components/Section";
import { Toaster } from "@/components/ui/sonner";
import { AriaApprovals, type AriaTaskRow } from "@/components/aria/AriaApprovals";
import { SendPropertySheet } from "@/components/aria/SendPropertySheet";
import { statusShortLabel } from "@/lib/client-brief";
import { fmtPhone, humanizeSource, relTime } from "@/lib/utils";
import { MessagesThread, type AriaThreadState, type TextMessage } from "./aria-sms-panel";
import {
  BbaAndDocsCard,
  HomesCard,
  PreferencesCard,
  ShowingsCard,
  TimelineCard,
  type MatchedHome,
  type ShowingItem,
  type SignedBba,
} from "./client-sections";

export type { MatchedHome, ShowingItem };

type Activity = {
  id: string;
  type: string | null;
  direction: string | null;
  body: string | null;
  ai_draft: boolean | null;
  approved: boolean | null;
  sent: boolean | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type Props = {
  client: Record<string, unknown>;
  activities: Activity[];
  homes: MatchedHome[];
  showings: ShowingItem[];
  ariaTasks: AriaTaskRow[];
  ariaThread: AriaThreadState;
  bba: SignedBba;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

export function ClientDetail({ client, activities, homes, showings, ariaTasks, ariaThread, bba }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState<MatchedHome | null>(null);

  const id = String(client.id);
  const name = str(client.name) ?? "Client";
  const firstName = name.split(" ")[0];
  const phone = str(client.phone);
  const email = str(client.email);
  const source = humanizeSource(str(client.lead_source) ?? str(client.source));
  const canText = Boolean(phone) && !ariaThread.optedOut;

  // Unapproved AI drafts were never sent — they aren't part of the thread.
  const texts: TextMessage[] = activities
    .filter((a) => a.type === "text" && !(a.ai_draft && !a.approved && !a.sent))
    .map((a) => ({ id: a.id, direction: a.direction, body: a.body, sent: Boolean(a.sent), created_at: a.created_at, metadata: a.metadata }));
  const timeline = activities.filter((a) => a.type !== "text").reverse();
  const lastContact = activities.at(-1)?.created_at ?? null;

  const showingRequests = showings
    .filter((s) => s.status === "requested")
    .map((s) => ({ ...s, client: null }));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-6 sm:px-8 sm:pt-10">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/clients"))}
          aria-label="Back"
          className="mb-5 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-4" />
        </button>

        <header className="mb-8">
          <h1 className="font-heading text-[32px] leading-tight text-foreground">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Pill tone="primary">{statusShortLabel(str(client.status))}</Pill>
            {source ? <Pill>{source}</Pill> : null}
            {str(client.client_role) === "seller" ? <Pill>Seller</Pill> : null}
            <span className="font-display text-caption text-muted-foreground">
              {lastContact ? `Last contact ${relTime(lastContact)}` : "No contact yet"}
            </span>
          </div>
          {phone || email ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 font-display text-caption font-semibold text-foreground">
                  <Phone className="size-3.5" /> {fmtPhone(phone)}
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border bg-card px-3.5 py-2 font-display text-caption font-semibold text-foreground">
                  <Mail className="size-3.5 shrink-0" /> <span className="truncate">{email}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </header>

        <AriaApprovals showingRequests={showingRequests} tasks={ariaTasks} />

        <MessagesThread clientId={id} firstName={firstName} state={ariaThread} messages={texts} />

        <PreferencesCard
          key={String(client.updated_at ?? "")}
          clientId={id}
          prefs={{
            name,
            status: str(client.status),
            client_role: str(client.client_role),
            budget_min: num(client.budget_min),
            budget_max: num(client.budget_max),
            preferred_towns: Array.isArray(client.preferred_towns) ? (client.preferred_towns as string[]) : null,
            town: str(client.town),
            beds_wanted: num(client.beds_wanted),
            baths_wanted: num(client.baths_wanted),
            timeline: str(client.timeline),
            notes: str(client.notes),
            phone,
            email,
          }}
        />

        <HomesCard homes={homes} canSend={canText} onSend={setSending} />

        <ShowingsCard showings={showings} />

        <BbaAndDocsCard clientId={id} firstName={firstName} bba={bba} canText={canText} />

        <TimelineCard items={timeline} />
      </div>

      <SendPropertySheet property={sending} target={sending ? { id, name } : null} onClose={() => setSending(null)} />
      <Toaster />
    </div>
  );
}
