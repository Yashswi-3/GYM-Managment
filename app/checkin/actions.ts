"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMobile } from "@/lib/phone";
import { rememberDeviceForMember, resolveDeviceToken } from "@/lib/deviceToken";

const mobileSchema = z.string().trim().min(7, "Enter a valid mobile number").max(20);
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

/**
 * The single place that answers "is this mobile a member who may check in".
 * An unapproved /join signup is a row in `members` but not a member yet
 * (see supabase/migrations/0010_member_approval.sql) — and three call sites
 * asking that question by hand is precisely why the gate was missed the
 * first time, so they all route through here instead.
 */
async function findApprovedMemberByMobile(mobile: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("members")
    .select("id, name")
    .eq("mobile", normalizeMobile(mobile))
    .not("approved_at", "is", null)
    .maybeSingle();
  return data;
}

/**
 * FR8/NFR5 — looks up a mobile number server-side only. Returns just enough
 * to drive the UI (recognized + first name for a friendly greeting) and
 * nothing else about the member, so the public check-in page never has
 * direct table access or sees other members' data.
 */
export async function lookupMobile(mobileInput: string) {
  const parsed = mobileSchema.safeParse(mobileInput);
  if (!parsed.success) return { recognized: false as const };

  const member = await findApprovedMemberByMobile(parsed.data);
  if (!member) return { recognized: false as const };
  return { recognized: true as const, firstName: member.name.split(" ")[0] };
}

/**
 * FR8 — one tap beyond the scan: recognized member confirms and an
 * attendance row is written immediately. Also remembers this browser
 * (device_tokens) so future visits can skip the form entirely.
 */
export async function checkInMember(mobileInput: string) {
  const parsed = mobileSchema.safeParse(mobileInput);
  if (!parsed.success) return { ok: false as const, error: "Invalid mobile number" };

  const member = await findApprovedMemberByMobile(parsed.data);
  if (!member) return { ok: false as const, error: "Member not found" };

  const supabase = await createServiceClient();
  const { error } = await supabase.from("attendance").insert({ member_id: member.id });
  if (error) return { ok: false as const, error: error.message };

  await rememberDeviceForMember(member.id);

  return { ok: true as const, name: member.name };
}

/**
 * FR5 — unrecognized mobile: two fields, one button, creates a visitor record.
 */
export async function registerVisitor(nameInput: string, mobileInput: string) {
  const name = nameSchema.safeParse(nameInput);
  const mobile = mobileSchema.safeParse(mobileInput);
  if (!name.success) return { ok: false as const, error: name.error.issues[0].message };
  if (!mobile.success) return { ok: false as const, error: mobile.error.issues[0].message };

  const normalizedMobile = normalizeMobile(mobile.data);
  const supabase = await createServiceClient();

  // Guard against a race where the mobile became a member between lookup and
  // submit. Same approval question as lookupMobile, so same helper: an
  // unapproved signup filling this form is a genuine visitor, not a member
  // being sent down a check-in path that would only reject them.
  const existingMember = await findApprovedMemberByMobile(mobile.data);
  if (existingMember) {
    return checkInMember(mobile.data);
  }

  const { error } = await supabase
    .from("visitors")
    .insert({ name: name.data, mobile: normalizedMobile });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, name: name.data };
}

/**
 * Remembered-device flow: called on every /checkin page load before showing
 * any form. If this browser has a valid device_tokens cookie tied to a
 * member, attendance is logged immediately with zero taps — true
 * scan-and-done. Falls back to the normal mobile-entry form if there's no
 * cookie, or it doesn't resolve to a member (new phone, cleared cookies,
 * shared device that isn't recognized, etc).
 */
export async function attemptDeviceCheckIn() {
  const member = await resolveDeviceToken();
  if (!member) return { ok: false as const };

  const supabase = await createServiceClient();
  const { error } = await supabase.from("attendance").insert({ member_id: member.id });
  if (error) return { ok: false as const };

  return { ok: true as const, name: member.name };
}
