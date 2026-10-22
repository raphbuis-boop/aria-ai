import type { SupabaseClient } from "@supabase/supabase-js";
import { newLeadEmail, sendEmail } from "@/lib/resend";

/** The agent's email: their profile's, else their sign-in address. */
async function agentEmail(admin: SupabaseClient, agentId: string): Promise<string | null> {
  const { data: profile } = await admin.from("agent_profiles").select("email").eq("id", agentId).maybeSingle();
  if (profile?.email) return profile.email as string;
  const { data } = await admin.auth.admin.getUserById(agentId);
  return data?.user?.email ?? null;
}

/**
 * Emails the agent the moment a lead arrives, with a link straight to the
 * client. The in-app bell only helps while Aria is open; this reaches the
 * agent's phone. Never throws — a failed alert must not lose the lead.
 * Call with a service-role client.
 */
export async function emailAgentAboutLead(
  admin: SupabaseClient,
  lead: { agentId: string; clientId: string; clientName: string; sourceLabel: string; inquiry: string | null; isNew: boolean },
): Promise<void> {
  try {
    const to = await agentEmail(admin, lead.agentId);
    if (!to) return;
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://getariaai.com").replace(/\/$/, "");
    await sendEmail({
      to,
      subject: lead.isNew ? `New ${lead.sourceLabel} lead: ${lead.clientName}` : `${lead.clientName} reached out again`,
      html: newLeadEmail({
        clientName: lead.clientName,
        sourceLabel: lead.sourceLabel,
        inquiry: lead.inquiry,
        clientUrl: `${site}/clients/${lead.clientId}`,
        isNew: lead.isNew,
      }),
    });
  } catch (error) {
    console.error("[lead-alerts] new lead email failed", { clientId: lead.clientId, error });
  }
}
