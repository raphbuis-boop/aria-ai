import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { BackButton } from "@/components/BackButton";

type Activity = {
  id: string;
  type: string | null;
  body: string | null;
  ai_draft: boolean;
  approved: boolean;
  sent: boolean;
  created_at: string;
};

function activityDot(a: Activity): string {
  if (a.type === "email" && a.sent) return "#3B82F6";   // blue — email sent
  if (a.type === "text" && a.sent) return "#1a9b5e";    // green — text sent
  if (a.type === "text" && a.ai_draft && !a.approved) return "#d97706"; // amber — pending
  if (a.type === "call") return "#0a7cff";               // blue — call
  if (a.type === "note") return "#6B7280";               // gray — note
  return "#48484a";
}

function activityLabel(a: Activity): string {
  if (a.type === "email" && a.sent) return "Email sent";
  if (a.type === "email") return "Email";
  if (a.type === "text" && a.ai_draft && !a.approved) return "AI draft pending";
  if (a.type === "text" && a.sent) return "Text sent";
  if (a.type === "call") return "Call logged";
  if (a.type === "note") return "Note";
  return a.type ?? "Activity";
}

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export default async function ClientActivityPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!client) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, body, ai_draft, approved, sent, created_at")
    .eq("client_id", params.id)
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  const all = (activities ?? []) as Activity[];

  return (
    <div
      className="min-h-[100dvh] pb-[130px]"
      style={{ color: "var(--oc-text-1)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <BackButton />
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
            Activity
          </h1>
          <p className="text-[12px]" style={{ color: "#6B7280" }}>
            {client.name}
          </p>
        </div>
      </div>

      <div className="px-5">
        {all.length === 0 ? (
          <div
            style={{
              background: "rgba(20,20,22,0.7)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              padding: "24px 16px",
              textAlign: "center",
            }}
          >
            <p className="text-[13px]" style={{ color: "#6B7280" }}>
              No activity yet
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(20,20,22,0.7)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {all.map((a, i) => (
              <div
                key={a.id}
                className="flex items-start gap-3 px-4 py-3.5"
                style={
                  i > 0 ? { borderTop: "0.5px solid rgba(255,255,255,0.06)" } : {}
                }
              >
                {/* Dot */}
                <div
                  className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: activityDot(a) }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="text-[13px] font-medium capitalize"
                      style={{ color: "#e0e0e5" }}
                    >
                      {activityLabel(a)}
                    </p>
                    <p
                      className="flex-shrink-0 text-[11px]"
                      style={{ color: "#6B7280" }}
                    >
                      {relTime(a.created_at)}
                    </p>
                  </div>
                  {a.body ? (
                    <p
                      className="mt-0.5 line-clamp-3 text-[12px] leading-relaxed"
                      style={{ color: "#9CA3AF" }}
                    >
                      {a.body}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-[11px]" style={{ color: "#48484a" }}>
          {all.length} {all.length === 1 ? "entry" : "entries"} total
        </p>
      </div>
    </div>
  );
}
