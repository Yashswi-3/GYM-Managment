"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const visitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  mobile: z.string().trim().min(7, "Enter a valid mobile number").max(20),
  email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
});

/**
 * Dedicated visitor self-registration QR (separate poster from /checkin).
 * If the mobile already belongs to a member, we don't create a duplicate
 * visitor row — we tell them they're already a member and point them at
 * the regular check-in flow instead.
 */
export async function registerAsVisitor(nameInput: string, mobileInput: string, emailInput: string) {
  const parsed = visitSchema.safeParse({ name: nameInput, mobile: mobileInput, email: emailInput });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const supabase = await createServiceClient();
  const { name, mobile, email } = parsed.data;

  const { data: existingMember } = await supabase
    .from("members")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  if (existingMember) {
    return { ok: true as const, alreadyMember: true as const, name };
  }

  const { error } = await supabase.from("visitors").insert({ name, mobile, email: email || null });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, alreadyMember: false as const, name };
}
