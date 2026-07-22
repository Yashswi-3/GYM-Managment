"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeMobile } from "@/lib/phone";

const memberPaymentSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(7, "Enter a valid mobile number"),
  // Optional — the data model doesn't require it, but FR10/FR11 need it to
  // email the member directly. See supabase/migrations/0002_member_email.sql.
  email: z.string().trim().email().optional().or(z.literal("")),
  planName: z.string().trim().min(1, "Plan is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  validUntil: z.string().min(1, "Valid-until date is required"),
});

/**
 * FR1 + FR3 + FR6 — adds a member (or reuses an existing one by mobile),
 * records a payment against them, and — if a visitor record with the same
 * mobile exists and hasn't converted yet — links it. Conversion is implicit:
 * the moment a payment exists for that mobile, they're a member (FR6).
 */
export async function addMemberWithPayment(formData: FormData) {
  const parsed = memberPaymentSchema.safeParse({
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    email: formData.get("email"),
    planName: formData.get("planName"),
    amount: formData.get("amount"),
    validUntil: formData.get("validUntil"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { name, email, planName, amount, validUntil } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);
  const supabase = await createClient();

  let memberId: string;
  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  if (existing) {
    memberId = existing.id;
    if (email) {
      await supabase.from("members").update({ email }).eq("id", memberId);
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from("members")
      .insert({ name, mobile, email: email || null, plan_name: planName })
      .select("id")
      .single();
    if (insertError || !created) {
      return { ok: false, error: insertError?.message ?? "Could not create member" };
    }
    memberId = created.id;
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    member_id: memberId,
    amount,
    valid_until: validUntil,
  });
  if (paymentError) return { ok: false, error: paymentError.message };

  // FR6 — implicit visitor -> member conversion.
  await supabase
    .from("visitors")
    .update({ converted_member_id: memberId })
    .eq("mobile", mobile)
    .is("converted_member_id", null);

  revalidatePath("/admin");
  return { ok: true };
}

const visitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(7, "Enter a valid mobile number"),
  email: z.string().trim().email().optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Admin-side manual visitor add — the same data a walk-in would submit via the /visit QR. */
export async function addVisitorManually(formData: FormData) {
  const parsed = visitorSchema.safeParse({
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    email: formData.get("email"),
    remarks: formData.get("remarks"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("visitors").insert({
    name: parsed.data.name,
    mobile: normalizeMobile(parsed.data.mobile),
    email: parsed.data.email || null,
    remarks: parsed.data.remarks || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

const activateSchema = z.object({
  memberId: z.string().uuid(),
  planName: z.string().trim().min(1, "Plan is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  validUntil: z.string().min(1, "Valid-until date is required"),
});

/**
 * Turns a self-signed-up ("pending") member into an active one: sets their
 * plan and records the first payment. This is the whole point of the /join
 * QR — the admin never types the name/mobile, just the plan + amount + date.
 */
export async function activatePendingMember(formData: FormData) {
  const parsed = activateSchema.safeParse({
    memberId: formData.get("memberId"),
    planName: formData.get("planName"),
    amount: formData.get("amount"),
    validUntil: formData.get("validUntil"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { memberId, planName, amount, validUntil } = parsed.data;

  const { error: updateError } = await supabase
    .from("members")
    .update({ plan_name: planName })
    .eq("id", memberId);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: paymentError } = await supabase
    .from("payments")
    .insert({ member_id: memberId, amount, valid_until: validUntil });
  if (paymentError) return { ok: false, error: paymentError.message };

  revalidatePath("/admin");
  return { ok: true };
}

const paymentOnlySchema = z.object({
  memberId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  validUntil: z.string().min(1, "Valid-until date is required"),
});

/** FR3 — record a renewal payment against an existing member. */
export async function recordPayment(formData: FormData) {
  const parsed = paymentOnlySchema.safeParse({
    memberId: formData.get("memberId"),
    amount: formData.get("amount"),
    validUntil: formData.get("validUntil"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    member_id: parsed.data.memberId,
    amount: parsed.data.amount,
    valid_until: parsed.data.validUntil,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

const memberOverrideSchema = z.object({
  memberId: z.string().uuid(),
  statusOverride: z.enum(["active", "inactive", "auto"]),
});

/**
 * Manually forces a member active/inactive, or clears the override back to
 * derived-from-payment status.
 */
export async function setMemberActiveOverride(formData: FormData) {
  const parsed = memberOverrideSchema.safeParse({
    memberId: formData.get("memberId"),
    statusOverride: formData.get("statusOverride"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const isActiveOverride =
    parsed.data.statusOverride === "auto"
      ? null
      : parsed.data.statusOverride === "active";

  const { error } = await supabase
    .from("members")
    .update({ is_active_override: isActiveOverride })
    .eq("id", parsed.data.memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

export const toggleMemberActive = setMemberActiveOverride;

const updatePaymentDateSchema = z.object({
  paymentId: z.string().uuid(),
  newPaidOn: z.string().min(1, "Paid-on date is required"),
});

/** Update the paid_on date of a payment (for backdating/correcting activation date) */
export async function updatePaymentDate(formData: FormData) {
  const parsed = updatePaymentDateSchema.safeParse({
    paymentId: formData.get("paymentId"),
    newPaidOn: formData.get("newPaidOn"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ paid_on: parsed.data.newPaidOn })
    .eq("id", parsed.data.paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
