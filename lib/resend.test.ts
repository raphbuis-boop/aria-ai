import { describe, expect, it } from "vitest";
import { engagementAlertEmail, escapeHtml, showingReminderEmail } from "@/lib/resend";

describe("email templates", () => {
  it("escapes lead-supplied text", () => {
    expect(escapeHtml(`<a href="x">Bob & 'Sue'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Bob &amp; &#39;Sue&#39;&lt;/a&gt;");
  });

  it("never renders a lead name as markup", () => {
    const html = engagementAlertEmail({
      agentName: "Agent",
      clients: [{ name: '<a href="https://phish.example">Click</a>', days: 30 }],
    });
    expect(html).not.toContain('<a href="https://phish.example">');
    expect(html).toContain("&lt;a href=&quot;https://phish.example&quot;&gt;");

    const reminder = showingReminderEmail({
      agentName: "Agent",
      address: "<img src=x onerror=alert(1)>",
      clientName: "Dana",
      showingDate: "Thu, Oct 22, 5:00 PM",
      when: "today",
    });
    expect(reminder).not.toContain("<img src=x");
    expect(reminder).toContain("You have a showing today");
  });
});
