import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LEN = 6;
const CODE_RE = /^[a-z0-9]{6}$/;

function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LEN);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function ensureUniqueReferralCode(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = generateReferralCode();
    const { data } = await admin
      .from("waitlist")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate referral code");
}

async function getPosition(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<number> {
  const { data: row } = await admin
    .from("waitlist")
    .select("created_at")
    .eq("email", email)
    .maybeSingle();
  if (!row?.created_at) return 0;

  const { count } = await admin
    .from("waitlist")
    .select("*", { count: "exact", head: true })
    .lt("created_at", row.created_at);

  return (count ?? 0) + 1;
}

async function buildResponse(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const { data: row } = await admin
    .from("waitlist")
    .select("referral_code, referral_count")
    .eq("email", email)
    .maybeSingle();

  const position = await getPosition(admin, email);
  const referral_code = row?.referral_code ?? "";
  const referral_count = row?.referral_count ?? 0;

  return {
    success: true,
    position,
    referral_code,
    referral_count,
  };
}

export async function POST(req: Request) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: "Waitlist is not configured." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    let refRaw = String(body.ref ?? "").trim().toLowerCase();
    if (refRaw && !CODE_RE.test(refRaw)) {
      refRaw = "";
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: selErr } = await admin
      .from("waitlist")
      .select("id, referral_code")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { success: false, error: selErr.message },
        { status: 400 },
      );
    }

    if (existing) {
      if (!existing.referral_code) {
        const code = await ensureUniqueReferralCode(admin);
        await admin
          .from("waitlist")
          .update({ referral_code: code })
          .eq("id", existing.id);
      }
      return NextResponse.json(await buildResponse(admin, email));
    }

    const referralCode = await ensureUniqueReferralCode(admin);
    const insertPayload: Record<string, unknown> = {
      email,
      referral_code: referralCode,
    };
    if (refRaw) {
      insertPayload.referred_by = refRaw;
    }

    const { error: insErr } = await admin.from("waitlist").insert(insertPayload);

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: row2 } = await admin
          .from("waitlist")
          .select("id, referral_code")
          .eq("email", email)
          .maybeSingle();
        if (row2 && !row2.referral_code) {
          const code = await ensureUniqueReferralCode(admin);
          await admin
            .from("waitlist")
            .update({ referral_code: code })
            .eq("id", row2.id);
        }
        return NextResponse.json(await buildResponse(admin, email));
      }
      return NextResponse.json(
        { success: false, error: insErr.message },
        { status: 400 },
      );
    }

    if (refRaw) {
      const { error: rpcError } = await admin.rpc(
        "increment_waitlist_referral_by_code",
        { p_code: refRaw },
      );
      if (rpcError) {
        console.error("increment_waitlist_referral_by_code", rpcError);
        const { data: refRow } = await admin
          .from("waitlist")
          .select("id, referral_count")
          .eq("referral_code", refRaw)
          .maybeSingle();
        if (refRow) {
          await admin
            .from("waitlist")
            .update({ referral_count: (refRow.referral_count ?? 0) + 1 })
            .eq("id", refRow.id);
        }
      }
    }

    return NextResponse.json(await buildResponse(admin, email));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
