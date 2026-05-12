# Twilio — Toll-Free Verification Rejection Appeal

**Submit via:** Twilio Console → Help → "Get help" → Submit a support ticket. (Twilio explicitly requires appeals to go through Console support, not email.)

**Required subject format (per Twilio's documentation):**

```
Toll-Free Verification Rejection Appeal for Aria (+1XXXXXXXXXX)
```

Replace `+1XXXXXXXXXX` with your actual toll-free number. Include the original rejection ticket number in the body if you have it.

**Category to pick:** "Compliance" or "Toll-Free Verification" — whichever your Console offers.

---

## Body

Hi Twilio Trust Team,

I'm submitting an appeal for the recent rejection of toll-free verification for our number **+1XXXXXXXXXX**, registered under the business name **Aria** (operating as [getariaai.com](https://getariaai.com)). Original rejection ticket: **[INSERT TICKET # IF YOU HAVE IT]**.

The rejection cited three issues:
1. Non-business email address on the verification submission
2. Insufficient opt-in URL / unclear consent flow
3. Missing privacy policy

We've addressed all three since the original submission. The updated details are:

### 1. Business email

The verification was submitted before our domain email was set up. I am the founder and sole operator; the business operates as **Aria** at **getariaai.com**. Going forward, the verification contact email is `raph@getariaai.com` (replace with whatever your actual business email is).

### 2. Opt-in URL and consent flow

End users opt in to SMS communications in one of two explicit ways:

**(a) Listing inquiry form** at any property listing page on getariaai.com, e.g. https://getariaai.com/property-search — the form collects name, email, and an optional phone number; submitting it is the opt-in act. Submission UX explicitly states the user may be contacted by SMS regarding their inquiry.

**(b) Agent-led client onboarding** — when an agent adds a new client to their Aria CRM, the agent confirms the client has provided verbal or written consent before any SMS is sent. The agent is contractually bound by the Aria terms of service to obtain consent before sending.

In both cases, message frequency, opt-out instructions ("Reply STOP to unsubscribe"), and the linked privacy policy are surfaced to the recipient.

### 3. Privacy policy

We now have a published privacy policy at **https://getariaai.com/privacy**. It covers:

- What data we collect (name, email, phone, message content)
- How we use it (to facilitate real-estate transactions; never sold)
- Retention and deletion rights
- Specific SMS / TCPA language stating we obtain opt-in consent before sending messages and honor STOP / HELP keywords

### Sample message templates we send

For reference, the SMS we send fall into these categories:

- **Listing follow-up:** "Hi {name}, this is {agent_name} from Aria following up on your inquiry on {address}. Want to schedule a showing? Reply STOP to unsubscribe."
- **Showing reminder:** "Reminder: your showing of {address} is tomorrow at {time}. Reply HELP for help, STOP to opt out."
- **Daily agent briefing (agent → their own clients):** brief market or transaction updates initiated by the agent.

All messages include `Reply STOP to unsubscribe` per CTIA guidelines.

Please let me know if you need additional documentation — happy to share screen recordings of the opt-in flow or provide read-only access to our production environment.

Thanks,

Raph Wasserlauf
Founder, Aria
raphbuis1@gmail.com
+1XXXXXXXXXX  (toll-free under appeal)
[getariaai.com](https://getariaai.com)

---

## Notes for submitting

- **Don't email this** — Twilio explicitly routes appeals through Console support tickets. Email won't get a Trust Team reviewer.
- **Subject line must match exactly** what Twilio's docs specify; otherwise the ticket gets re-routed and delayed.
- Pre-populate the **original rejection ticket number** if you can find it — it's in the email Twilio sent you with the rejection reasons.
- Be specific about opt-in. The #1 reason toll-free appeals get re-rejected is vague opt-in description. Linking to the actual form is gold.
- **Important:** Some sample message templates above reference variables like `{name}` and `{agent_name}` — that's fine to leave in, Twilio reviewers understand templates. But make sure your actual sent SMS does include explicit STOP language and the templates above match what your code actually sends (check `/api/sms/send/route.ts`).
- Lead time: Twilio typically responds in 3–10 business days. If you don't hear back in 14 days, reply to the ticket asking for an update.
