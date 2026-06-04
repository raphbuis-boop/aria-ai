/**
 * SmsService
 *
 * SMS sending lives entirely in app/api/sms/send/route.ts (Next.js API route)
 * because it requires the Twilio SDK (server-only), Supabase session from
 * getRouteSupabase(), and activity persistence in one atomic flow.
 *
 * There is no standalone lib/ function to wrap — the API route IS the
 * implementation. Calling it from lib/services would require duplicating the
 * Twilio + Supabase logic, which violates the Phase 1 discipline.
 *
 * Phase 2 plan: extract a sendSms(params, supabase, user) pure function into
 * lib/sms.ts that the API route calls, then wrap that function here.
 */

export interface ISmsService {
  /**
   * Send an SMS via the existing /api/sms/send endpoint.
   * This is a client-side fetch wrapper only — no Twilio logic here.
   *
   * @param clientId  Supabase clients.id
   * @param to        E.164 phone number (formatPhoneE164 must be called first)
   * @param body      Message text
   * @param activityId  Optional: existing activity row to update instead of insert
   */
  send(params: {
    clientId: string;
    to: string;
    body: string;
    activityId?: string;
  }): Promise<{ success: boolean; messageSid?: string; error?: string }>;
}

export const SmsService: ISmsService = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(params) {
    // TODO: Phase 2 — extract lib/sms.ts from app/api/sms/send/route.ts so
    // this can call the pure function directly (server-side) rather than going
    // through HTTP. For now the client-side fetch path is the only safe wrapper.
    //
    // This method intentionally does NOT use fetch("/api/sms/send") either —
    // that would be a browser-only call that breaks server contexts. Leave as
    // TODO until the lib extraction is done.
    throw new Error(
      "TODO: not yet implemented — Phase 2. " +
        "Need to extract sendSms() from app/api/sms/send/route.ts into lib/sms.ts first. " +
        "Until then, call POST /api/sms/send directly from the UI.",
    );
  },
};
