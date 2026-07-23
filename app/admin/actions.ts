"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeMobile } from "@/lib/phone";
import { notifyMemberAndOwner } from "@/lib/email";
import { GYM_NAME } from "@/lib/site";

const memberPaymentSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(7, "Enter a valid mobile number"),
  // Optional — the data model doesn't require it, but FR10/FR11 need it to
  // email the member directly. See supabase/migrations/0002_member_email.sql.
  email: z.string().trim().email().optional().or(z.literal("")),
  planName: z.string().trim().min(1, "Plan is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  validUntil: z.string().min(1, "Valid-until date is required"),
  paymentDone: z.enum(["yes", "no"]),
});

/**
 * FR6 — a visitor with this mobile number just became a paying member;
 * link their visitor record so the Visitors tab shows them as converted
 * instead of still "Visitor". No-op if no matching unconverted visitor exists.
 */
async function convertVisitorForMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mobile: string,
  memberId: string
) {
  await supabase
    .from("visitors")
    .update({ converted_member_id: memberId })
    .eq("mobile", mobile)
    .is("converted_member_id", null);
}

/**
 * Admin marked a new member's payment as not done: the plan/amount/due-date
 * they entered is still saved (handled by the caller) so the table shows
 * what's owed and by when, but the member is force-flagged Payment Incomplete
 * rather than left to derive Active from a payment that hasn't happened, and
 * both the owner and the member (if they gave an email) hear about it now
 * rather than waiting for the daily reminder job.
 */
async function markPaymentIncompleteAndNotify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
  memberName: string,
  memberEmail: string | null
) {
  await supabase.from("members").update({ is_active_override: false }).eq("id", memberId);
  await notifyMemberAndOwner(
    memberEmail,
    memberName,
    `Welcome to ${GYM_NAME} — payment pending`,
    `Welcome to ${GYM_NAME}! Your membership starts today. Your payment is still incomplete — please complete your payment for smoother access.`
  );
}

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
    paymentDone: formData.get("paymentDone"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { name, email, planName, amount, validUntil, paymentDone } = parsed.data;
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

  await convertVisitorForMember(supabase, mobile, memberId);

  if (paymentDone === "no") {
    await markPaymentIncompleteAndNotify(supabase, memberId, name, email || null);
  }

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
  paymentDone: z.enum(["yes", "no"]),
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
    paymentDone: formData.get("paymentDone"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { memberId, planName, amount, validUntil, paymentDone } = parsed.data;

  const { data: member, error: memberError } = await supabase
    .from("members")
    .update({ plan_name: planName })
    .eq("id", memberId)
    .select("mobile, name, email")
    .single();
  if (memberError) return { ok: false, error: memberError.message };

  const { error: paymentError } = await supabase
    .from("payments")
    .insert({ member_id: memberId, amount, valid_until: validUntil });
  if (paymentError) return { ok: false, error: paymentError.message };

  await convertVisitorForMember(supabase, member.mobile, memberId);

  if (paymentDone === "no") {
    await markPaymentIncompleteAndNotify(supabase, memberId, member.name, member.email);
  }

  revalidatePath("/admin");
  return { ok: true };
}

const paymentOnlySchema = z.object({
  memberId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  validUntil: z.string().min(1, "Valid-until date is required"),
});

/**
 * FR3 — record a renewal payment against an existing member. Also clears
 * any manual Payment Incomplete override: a fresh payment is the one event
 * that should always resume automatic (date-based) status tracking, so an
 * admin never has to remember to flip the override back themselves.
 */
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

  await supabase
    .from("members")
    .update({ is_active_override: null })
    .eq("id", parsed.data.memberId);

  revalidatePath("/admin");
  return { ok: true };
}

const memberOverrideSchema = z.object({
  memberId: z.string().uuid(),
  statusOverride: z.enum(["inactive", "auto"]),
});

/**
 * Manually flags a member Payment Incomplete regardless of the calendar
 * (e.g. a bounced payment), or clears the override back to automatic,
 * date-derived status. There's deliberately no manual "force Complete" —
 * the only correct way to mark someone as paid is recordPayment, which
 * records what was actually collected and lets Auto derive Complete from
 * the real due date. A button that just declares "Complete" with nothing
 * behind it is exactly the kind of shortcut that gets misused instead of
 * recording the actual payment.
 */
export async function setMemberActiveOverride(formData: FormData) {
  const parsed = memberOverrideSchema.safeParse({
    memberId: formData.get("memberId"),
    statusOverride: formData.get("statusOverride"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const isActiveOverride = parsed.data.statusOverride === "auto" ? null : false;

  const { error } = await supabase
    .from("members")
    .update({ is_active_override: isActiveOverride })
    .eq("id", parsed.data.memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

const updateMemberSchema = z.object({
  memberId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(7, "Enter a valid mobile number"),
  email: z.string().trim().email().optional().or(z.literal("")),
  planName: z.string().trim().min(1, "Plan is required"),
  // Present only when the member already has a payment to edit — a brand
  // new pending signup won't have one yet, so these stay optional.
  paymentId: z.string().uuid().optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  paidOn: z.string().min(1).optional(),
  validUntil: z.string().min(1).optional(),
});

/**
 * Edit everything about a member from one form: their own details plus
 * (when they already have a payment on file) that payment's amount/paid-on/
 * valid-until, so corrections don't require a second, separate table.
 * Recording a brand-new payment cycle is a different action — see recordPayment.
 */
export async function updateMember(formData: FormData) {
  const parsed = updateMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    email: formData.get("email"),
    planName: formData.get("planName"),
    paymentId: formData.get("paymentId") || undefined,
    amount: formData.get("amount") || undefined,
    paidOn: formData.get("paidOn") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { memberId, name, planName, paymentId, amount, paidOn, validUntil } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({ name, mobile, email: parsed.data.email || null, plan_name: planName })
    .eq("id", memberId);

  if (error) {
    // Postgres unique-violation code — the edited mobile belongs to someone else.
    if (error.code === "23505") {
      return { ok: false, error: "That mobile number already belongs to another member." };
    }
    return { ok: false, error: error.message };
  }

  if (paymentId && amount !== undefined && paidOn && validUntil) {
    const { error: paymentError } = await supabase
      .from("payments")
      .update({ amount, paid_on: paidOn, valid_until: validUntil })
      .eq("id", paymentId);
    if (paymentError) return { ok: false, error: paymentError.message };

    // Same reasoning as recordPayment: correcting/confirming a payment here
    // is evidence the member is paid up, so any manual Payment Incomplete
    // flag should clear too — otherwise it stays stuck even after the
    // payment is entered correctly.
    await supabase.from("members").update({ is_active_override: null }).eq("id", memberId);
  }

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Hard delete: removes the member row outright. Cascading deletes already
 * set up in migration 0001 take their payments, attendance, notification
 * history, and remembered-device tokens with them — nothing left behind.
 * Chosen over a soft-delete/archive flag to keep this simple and to avoid
 * accumulating dead rows indefinitely on the free-tier Supabase plan.
 */
export async function deleteMember(formData: FormData) {
  const memberId = formData.get("memberId");
  if (typeof memberId !== "string" || !memberId) {
    return { ok: false, error: "Missing member id" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
