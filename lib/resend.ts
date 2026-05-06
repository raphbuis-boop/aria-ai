import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Aria <no-reply@getariaai.com>";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY not set — skipping email");
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error("[resend] send error", error);
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function showingReminderEmail(opts: {
  agentName: string;
  address: string;
  clientName: string;
  showingDate: string;
  hoursAway: number;
}): string {
  const when = opts.hoursAway <= 2 ? "in about 2 hours" : "tomorrow";
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a0a0f;color:#d0d0e0;padding:32px;max-width:520px;margin:0 auto;">
  <div style="background:#12121e;border:1px solid #1e1e2e;border-radius:16px;padding:28px;">
    <p style="color:#6f9bff;font-size:13px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:.08em;">Showing Reminder</p>
    <h2 style="color:#ffffff;font-size:20px;margin:0 0 8px;">You have a showing ${when}</h2>
    <p style="color:#888898;font-size:14px;margin:0 0 20px;">${opts.showingDate}</p>
    <div style="background:#0e0e1a;border:1px solid #1e1e2e;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#d0d0e0;">${opts.address}</p>
      <p style="margin:0;font-size:13px;color:#666680;">Client: ${opts.clientName}</p>
    </div>
    <a href="https://getariaai.com/showings"
       style="display:inline-block;background:#4f7bff;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:10px;text-decoration:none;">
      View in Aria →
    </a>
  </div>
  <p style="color:#333350;font-size:11px;margin-top:20px;text-align:center;">Aria · getariaai.com</p>
</body>
</html>`;
}

export function engagementAlertEmail(opts: {
  agentName: string;
  clients: { name: string; days: number }[];
}): string {
  const rows = opts.clients
    .map(
      (c) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#d0d0e0;border-bottom:1px solid #1e1e2e;">${c.name}</td>
      <td style="padding:8px 0;font-size:13px;color:#f59e0b;text-align:right;border-bottom:1px solid #1e1e2e;">${c.days} days silent</td>
    </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a0a0f;color:#d0d0e0;padding:32px;max-width:520px;margin:0 auto;">
  <div style="background:#12121e;border:1px solid #1e1e2e;border-radius:16px;padding:28px;">
    <p style="color:#f59e0b;font-size:13px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:.08em;">Engagement Alert</p>
    <h2 style="color:#ffffff;font-size:20px;margin:0 0 8px;">${opts.clients.length} client${opts.clients.length === 1 ? "" : "s"} need${opts.clients.length === 1 ? "s" : ""} follow-up</h2>
    <p style="color:#888898;font-size:14px;margin:0 0 20px;">These clients haven't been contacted recently.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${rows}
    </table>
    <a href="https://getariaai.com/clients"
       style="display:inline-block;background:#4f7bff;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:10px;text-decoration:none;">
      Open Clients →
    </a>
  </div>
  <p style="color:#333350;font-size:11px;margin-top:20px;text-align:center;">Aria · getariaai.com</p>
</body>
</html>`;
}
