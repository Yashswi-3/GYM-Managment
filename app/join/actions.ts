"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
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
 *
 * Bound directly to the <form action={...}> (see app/join/page.tsx) rather
 * than called from a client onSubmit handler. That's what makes this a
 * true no-JS-required submission: on a slow/flaky connection where the
 * page's JS bundle never loads or hydrates, the browser still does a plain
 * HTML POST straight to this function and the signup still saves — instead
 * of silently doing nothing, which is what a JS-only onClick handler does
 * when the JS never arrives.
 */
export async function joinAsMember(formData: FormData) {
  const parsed = joinSchema.safeParse({
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirect(`/join?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
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
    redirect(`/join?done=1&already=1&name=${encodeURIComponent(name)}`);
  }

  const { data: created, error } = await supabase
    .from("members")
    .insert({ name, mobile, email })
    .select("id")
    .single();
  if (error || !created) {
    redirect(`/join?error=${encodeURIComponent(error?.message ?? "Could not sign up")}`);
  }

  await rememberDeviceForMember(created.id);
  redirect(`/join?done=1&already=0&name=${encodeURIComponent(name)}`);
}
