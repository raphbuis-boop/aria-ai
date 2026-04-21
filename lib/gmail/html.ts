/**
 * HTML helpers for outgoing email:
 *   • `renderEmailBody(rawHtml)` — wraps the composer's HTML in a safe
 *     email-client-friendly shell (600px table, brand color, signature).
 *   • `renderPropertyCard(...)` — inline property card (photo, address,
 *     price, beds/baths, CTA).  Designed to render cleanly in Gmail,
 *     Apple Mail, Outlook Web, and mobile clients.
 *   • `renderTemplate(template, vars)` — simple {{var}} substitution.
 */

export interface PropertyCardData {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  mlsNumber?: string | null;
  photos?: (string | null | undefined)[] | null;
  detailUrl?: string | null;
}

export interface EmailShellContext {
  agentName?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  brandColor?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoneyEmail(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtSqft(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return `${Math.round(v).toLocaleString("en-US")} sqft`;
}

export function renderPropertyCard(
  prop: PropertyCardData,
  accent = "#4f7bff",
): string {
  const addressLine = [prop.address, prop.city, prop.state]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join(", ");
  const postal = prop.postalCode ? ` ${escapeHtml(String(prop.postalCode))}` : "";
  const price = fmtMoneyEmail(prop.price ?? null);
  const beds = prop.beds != null ? `${prop.beds} bd` : "";
  const baths = prop.baths != null ? `${prop.baths} ba` : "";
  const sqft = fmtSqft(prop.sqft ?? null);
  const specLine = [beds, baths, sqft].filter(Boolean).join(" &middot; ");

  const photos = (prop.photos ?? [])
    .filter((u): u is string => typeof u === "string" && !!u)
    .slice(0, 3);

  const hero = photos[0];
  const thumbs = photos.slice(1);

  const ctaUrl = prop.detailUrl ?? "";
  const cta = ctaUrl
    ? `
        <tr>
          <td align="left" style="padding: 0 20px 20px;">
            <a href="${escapeHtml(ctaUrl)}"
               style="display: inline-block; background: ${escapeHtml(accent)}; color: #ffffff;
                      text-decoration: none; padding: 10px 18px; border-radius: 8px;
                      font-weight: 600; font-size: 13px; font-family: -apple-system, 'Segoe UI', sans-serif;">
              View listing &rarr;
            </a>
          </td>
        </tr>`
    : "";

  const thumbsRow =
    thumbs.length > 0
      ? `
        <tr>
          <td style="padding: 0 20px 14px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                ${thumbs
                  .map(
                    (u) =>
                      `<td width="50%" style="padding-right: 4px;">
                         <img src="${escapeHtml(u)}" alt=""
                              style="display: block; width: 100%; max-width: 280px;
                                     border-radius: 8px;" />
                       </td>`,
                  )
                  .join("")}
              </tr>
            </table>
          </td>
        </tr>`
      : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="border: 1px solid #e5e7eb; border-radius: 12px; margin: 16px 0; overflow: hidden;
              background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${
    hero
      ? `<tr>
          <td>
            <img src="${escapeHtml(hero)}" alt=""
                 style="display: block; width: 100%; max-width: 600px;" />
          </td>
        </tr>`
      : ""
  }
  <tr>
    <td style="padding: 18px 20px 6px;">
      ${
        price
          ? `<div style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
               ${escapeHtml(price)}
             </div>`
          : ""
      }
      ${
        addressLine
          ? `<div style="font-size: 14px; color: #374151; margin-top: 4px;">
               ${addressLine}${postal}
             </div>`
          : ""
      }
      ${
        specLine
          ? `<div style="font-size: 13px; color: #6b7280; margin-top: 8px;">
               ${specLine}${prop.mlsNumber ? ` &middot; MLS# ${escapeHtml(String(prop.mlsNumber))}` : ""}
             </div>`
          : prop.mlsNumber
            ? `<div style="font-size: 13px; color: #6b7280; margin-top: 8px;">
                 MLS# ${escapeHtml(String(prop.mlsNumber))}
               </div>`
            : ""
      }
    </td>
  </tr>
  ${thumbsRow}
  ${cta}
</table>`;
}

export function renderEmailBody(
  innerHtml: string,
  ctx: EmailShellContext = {},
): string {
  const brand = ctx.brandColor || "#4f7bff";
  const signature =
    ctx.agentName || ctx.agentEmail || ctx.agentPhone
      ? `
        <tr>
          <td style="padding: 20px 24px 28px; border-top: 1px solid #eef0f3;
                     font-size: 12px; color: #6b7280;
                     font-family: -apple-system, 'Segoe UI', sans-serif;">
            ${ctx.agentName ? `<div style="font-weight: 600; color: #111827;">${escapeHtml(ctx.agentName)}</div>` : ""}
            ${ctx.agentEmail ? `<div>${escapeHtml(ctx.agentEmail)}</div>` : ""}
            ${ctx.agentPhone ? `<div>${escapeHtml(ctx.agentPhone)}</div>` : ""}
          </td>
        </tr>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f4f5f7;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:#f4f5f7;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
               style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 14px;
                      box-shadow: 0 1px 2px rgba(16,24,40,0.04); border: 1px solid #e5e7eb;">
          <tr>
            <td style="padding: 22px 24px 6px; border-top: 4px solid ${escapeHtml(brand)};
                       border-radius: 14px 14px 0 0;"></td>
          </tr>
          <tr>
            <td style="padding: 6px 24px 18px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
                       font-size: 15px; line-height: 1.55; color: #1f2937;">
              ${innerHtml}
            </td>
          </tr>
          ${signature}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Lightweight {{var}} substitution for email templates. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_m, key) => {
    const v = vars[key];
    if (v == null) return "";
    return String(v);
  });
}
