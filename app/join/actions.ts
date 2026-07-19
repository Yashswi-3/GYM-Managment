"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMobile } from "@/lib/phone";
import { rememberDeviceForMember } from "@/lib/deviceToken";

const joinSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  mobile: z.string().trim().min(7, "Enter a valid mobile number").max(20),
  email: z.string().trim().email("Enter a valid email").max(200),
});

/**
 * Self-signup: a member scans the "join" QR, fills name/mobile/email, and
 * lands in the members table with no payment yet. The admin dashboard's
 * Pending Signups panel is what turns this into a real, active member once
 * the owner adds an amount and valid-until date — the admin never has to
 * hand-type the name/mobile themselves. Also remembers this browser so
 * future /checkin visits skip straight to attendance with no form at all.
 */
export async function joinAsMember(nameInput: string, mobileInput: string, emailInput: string) {
  const parsed = joinSchema.safeParse({ name: nameInput, mobile: mobileInput, email: emailInput });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const supabase = await createServiceClient();
  const { name, email } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);

  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  if (existing) {
    await rememberDeviceForMember(existing.id);
    return { ok: true as const, alreadyRegistered: true as const, name };
  }

  const { data: created, error } = await supabase
    .from("members")
    .insert({ name, mobile, email })
    .select("id")
    .single();
  if (error || !created) return { ok: false as const, error: error?.message ?? "Could not sign up" };

  await rememberDeviceForMember(created.id);

  return { ok: true as const, alreadyRegistered: false as const, name };
}
