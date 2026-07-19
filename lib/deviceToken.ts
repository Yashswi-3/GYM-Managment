import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export const DEVICE_COOKIE = "gym_device_token";

// ~400 days — the practical maximum most browsers (Chrome included) will
// actually honor for a cookie's lifetime, which comfortably covers the
// "at least a month, ideally longer" requirement.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

/**
 * Call this after any moment that definitively identifies "this browser
 * belongs to member X" — a successful /join signup, or a successful
 * mobile-number check-in. Stores an opaque random token (never the mobile
 * number itself) in a new device_tokens row, and sets it as a long-lived,
 * httpOnly cookie so it can't be read or tampered with from client JS.
 */
export async function rememberDeviceForMember(memberId: string): Promise<void> {
  const token = crypto.randomUUID();
  const supabase = await createServiceClient();
  const { error } = await supabase.from("device_tokens").insert({ token, member_id: memberId });
  if (error) return; // best-effort — failing to remember the device just means the fallback form is used next time

  const cookieStore = await cookies();
  cookieStore.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

/**
 * Reads the device cookie (if any) and resolves it to a member. Returns
 * null for: no cookie, an unrecognized/expired token, or a deleted member —
 * any of which should fall back to the normal check-in form, never error.
 */
export async function resolveDeviceToken(): Promise<{ id: string; name: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!token) return null;

  const supabase = await createServiceClient();
  const { data: deviceRow } = await supabase
    .from("device_tokens")
    .select("member_id")
    .eq("token", token)
    .maybeSingle();
  if (!deviceRow) return null;

  const { data: member } = await supabase
    .from("members")
    .select("id, name")
    .eq("id", deviceRow.member_id)
    .maybeSingle();
  if (!member) return null;

  return { id: member.id, name: member.name };
}
