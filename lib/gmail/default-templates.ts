/**
 * The 6 email templates we seed for every new agent.
 *
 * Variables use `{{var}}` syntax (see `renderTemplate` in `./html.ts`):
 *   {{client_name}}   {{client_first_name}}
 *   {{property_address}}  {{price}}
 *   {{agent_name}}  {{agent_email}}  {{agent_phone}}
 *
 * Agents can edit these freely after seeding; editing does NOT touch other
 * agents' copies.
 */

export interface DefaultTemplate {
  system_key: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    system_key: "new_property_match",
    name: "New property match",
    subject: "A new listing that fits what you're looking for",
    sort_order: 10,
    body: `<p>Hi {{client_first_name}},</p>
<p>A new listing just came up that lines up with what you're looking for — {{property_address}}, asking {{price}}. I've attached the details below.</p>
<p>Happy to set up a private showing this week. Let me know what days work best.</p>
<p>— {{agent_name}}</p>`,
  },
  {
    system_key: "post_showing_followup",
    name: "Post-showing follow-up",
    subject: "Following up on {{property_address}}",
    sort_order: 20,
    body: `<p>Hi {{client_first_name}},</p>
<p>Thanks again for coming out to see {{property_address}}. I'd love to hear your honest reaction — what clicked, what didn't, anything you want to dig into more?</p>
<p>If you're interested I can pull comps and put together a pricing strategy. Otherwise I'll keep the search moving and line up the next round.</p>
<p>— {{agent_name}}</p>`,
  },
  {
    system_key: "past_client_checkin",
    name: "Check-in (past client)",
    subject: "Quick hello, {{client_first_name}}",
    sort_order: 30,
    body: `<p>Hi {{client_first_name}},</p>
<p>Hope everything's going well and the house is treating you right. No agenda here — just wanted to check in and say hello.</p>
<p>If you or anyone close to you is thinking about a move in the next 6–12 months, I'm always a text or call away.</p>
<p>— {{agent_name}}</p>`,
  },
  {
    system_key: "market_update",
    name: "Market update",
    subject: "Your {{client_first_name}} market snapshot",
    sort_order: 40,
    body: `<p>Hi {{client_first_name}},</p>
<p>Quick snapshot of what's happening in the towns you've been watching:</p>
<ul>
  <li><b>Inventory</b> — [fill in]</li>
  <li><b>Days on market</b> — [fill in]</li>
  <li><b>List-to-sale price ratio</b> — [fill in]</li>
</ul>
<p>If you want to talk through what this means for your timing, I'm around this week.</p>
<p>— {{agent_name}}</p>`,
  },
  {
    system_key: "offer_submitted",
    name: "Offer submitted",
    subject: "Offer submitted — {{property_address}}",
    sort_order: 50,
    body: `<p>Hi {{client_first_name}},</p>
<p>Just sent your offer for {{property_address}} over to the listing agent. Here's where we are:</p>
<ul>
  <li><b>Offer price:</b> {{price}}</li>
  <li><b>Next step:</b> Listing side will review and come back with an answer or counter.</li>
</ul>
<p>I'll be on top of it and will call you the second I hear anything. Fingers crossed.</p>
<p>— {{agent_name}}</p>`,
  },
  {
    system_key: "closing_congrats",
    name: "Closing congratulations",
    subject: "Welcome home, {{client_first_name}} 🎉",
    sort_order: 60,
    body: `<p>{{client_first_name}} — congratulations!</p>
<p>You officially own {{property_address}}. It's been a real pleasure helping you get here, and I know how much this moment means.</p>
<p>I'll follow up in a few weeks once the dust settles, and in the meantime if anything at all comes up — a contractor recommendation, a tax question, anything — you know where to find me.</p>
<p>Here's to the next chapter.</p>
<p>— {{agent_name}}</p>`,
  },
];
