"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { fmtMoney } from "@/lib/utils";

// A saved-home card in the client portal. Emits behavioral engagement:
//   • "view"     — once per session when the client actually scrolls the card
//                  into view (deliberate look at a specific home).
//   • "favorite" — when the client taps the heart (strong intent signal).
// Both are attributed to the client via the portal token and are fail-soft:
// a logging failure never affects the portal.
function logEvent(
  token: string,
  eventType: "view" | "favorite",
  extra: Record<string, unknown>,
) {
  fetch("/api/engagement/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, event_type: eventType, ...extra }),
  }).catch(() => {
    /* never break the portal */
  });
}

export function PortalListingCard({
  token,
  listingId,
  address,
  price,
  reasons,
  mlsNumber,
}: {
  token: string;
  listingId: string;
  address: string;
  price: number | null;
  reasons: string[];
  mlsNumber?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [favorited, setFavorited] = useState(false);
  const favKey = `aa_fav_${token}_${listingId}`;
  const viewKey = `aa_view_${token}_${listingId}`;

  // Restore favorite state (per browser).
  useEffect(() => {
    try {
      if (localStorage.getItem(favKey)) setFavorited(true);
    } catch {
      /* ignore */
    }
  }, [favKey]);

  // Log a view once per session when the card is genuinely seen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      if (sessionStorage.getItem(viewKey)) return;
    } catch {
      /* ignore — still observe */
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            try {
              sessionStorage.setItem(viewKey, "1");
            } catch {
              /* ignore */
            }
            logEvent(token, "view", {
              listing_id: listingId,
              listing_address: address,
              mls_number: mlsNumber ?? null,
            });
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [token, listingId, address, mlsNumber, viewKey]);

  const toggleFavorite = () => {
    const next = !favorited;
    setFavorited(next);
    try {
      if (next) localStorage.setItem(favKey, "1");
      else localStorage.removeItem(favKey);
    } catch {
      /* ignore */
    }
    // Only log when turning ON (favoriting is the intent signal).
    if (next) {
      logEvent(token, "favorite", {
        listing_id: listingId,
        listing_address: address,
        mls_number: mlsNumber ?? null,
      });
    }
  };

  return (
    <div
      ref={ref}
      className="relative rounded-[14px] border border-border-card bg-bg-card p-4"
    >
      <button
        type="button"
        onClick={toggleFavorite}
        aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
        aria-pressed={favorited}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full transition-transform active:scale-90"
      >
        <Heart
          className="size-5"
          style={{
            fill: favorited ? "var(--accent-blue, #3B82F6)" : "transparent",
            color: favorited ? "var(--accent-blue, #3B82F6)" : "#9aa0aa",
          }}
        />
      </button>

      <div className="pr-9 text-[15px] font-medium text-text-primary">
        {address}
      </div>
      <div className="text-[14px] text-accent-blue">{fmtMoney(price)}</div>
      {reasons.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[12px] text-accent-green">
          {reasons.map((r) => (
            <li key={r}>✓ {r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
