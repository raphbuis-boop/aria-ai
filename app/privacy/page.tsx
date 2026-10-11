import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Aria",
  description: "How Aria handles personal data for real estate services.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          ← Back
        </Link>

        <header className="mt-6">
          <h1 className="text-[24px] font-semibold text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Effective date: October 7, 2026
          </p>
        </header>

        <div className="mt-8 space-y-6 rounded-[14px] border border-border bg-card p-5 text-[14px] leading-relaxed text-foreground/75">
          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Information we collect
            </h2>
            <p className="mt-2">
              Your account details (name, email, phone, brokerage); the clients,
              notes, showings, transactions and documents you add or import; the
              texts and emails you draft and send through Aria; and, if you
              connect Google, the Gmail messages, contacts and calendar events
              Aria needs for the features you use. We also collect basic usage
              and error data to keep the app working.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              How we use your information
            </h2>
            <p className="mt-2">
              To run the CRM for you: show who needs follow-up, match clients to
              homes, draft texts and emails in your voice, summarize email
              threads, check your calendar for showing conflicts, and keep your
              account secure. We do not use your data, or your clients&apos;
              data, to advertise to anyone, and we do not sell it.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Texting: Aria drafts, you send
            </h2>
            <p className="mt-2">
              Aria writes a draft; when you tap send it opens in your phone&apos;s
              own Messages app with the text filled in, and you send it. Aria
              does not send texts on its own. We record the text you chose to
              send on the client&apos;s timeline.
            </p>
            <p className="mt-2">
              Optional feature, currently off: Aria can also text leads from a
              dedicated business number through Twilio. It is not enabled for
              any account today. If it is turned on for your account, the
              messages and phone numbers involved are processed by Twilio, and
              we will tell you before it is.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Google data
            </h2>
            <p className="mt-2">
              If you connect Google, Aria reads your Gmail to show and summarize
              client threads and sends the replies you approve; reads your
              contacts when you import them; and reads (and, if you allow it,
              adds) calendar events for showings. You can disconnect in Settings
              at any time. Aria&apos;s use of information received from Google
              APIs adheres to the Google API Services User Data Policy, including
              its Limited Use requirements. Email content may be sent to
              Anthropic to produce summaries and drafts; it is not used to train
              AI models.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Who receives your data
            </h2>
            <p className="mt-2">
              Only the providers that run Aria, each limited to what it needs:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Supabase — sign-in, database and file storage.</li>
              <li>Vercel — hosting and server logs.</li>
              <li>Anthropic — AI drafting and summaries (client details and message text you ask Aria to work on).</li>
              <li>Google — Gmail, Contacts and Calendar, only if you connect them.</li>
              <li>Resend — sending account and reminder emails to you.</li>
              <li>SimplyRETS — MLS listing search (your search filters; no client data).</li>
              <li>Sentry — error reports used to fix bugs.</li>
              <li>PostHog — product usage analytics.</li>
              <li>Twilio — only if the optional Aria texting feature is turned on (see above).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              Account deletion and retention
            </h2>
            <p className="mt-2">
              You can delete your account yourself in Settings → Delete account.
              That permanently removes your account and the clients, activity,
              documents and other data in it. You can also export your clients
              first from Settings, or email{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-primary hover:underline"
              >
                support@getariaai.com
              </a>{" "}
              for help. Copies in provider backups expire on their normal
              schedule.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">
              New Jersey jurisdiction
            </h2>
            <p className="mt-2">
              This Privacy Policy is governed by the laws of the State of New
              Jersey, without regard to conflict-of-law rules. Any disputes
              relating to this policy are subject to applicable New Jersey venue
              and jurisdiction requirements.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data? Contact{" "}
              <a
                href="mailto:support@getariaai.com"
                className="font-medium text-primary hover:underline"
              >
                support@getariaai.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
