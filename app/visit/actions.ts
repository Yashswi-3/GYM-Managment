"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMobile } from "@/lib/phone";

const visitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  mobile: z.string().trim().min(7, "Enter a valid mobile number").max(20),
  email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

/**
 * Dedicated visitor self-registration QR (separate poster from /checkin).
 * If the mobile already belongs to a member, we don't create a duplicate
 * visitor row — we tell them they're already a member and point them at
 * the regular check-in flow instead.
 *
 * Bound directly to the <form action={...}> — see app/join/actions.ts for
 * why: it keeps the submission working even if the page's JS never loads.
 */
export async function registerAsVisitor(formData: FormData) {
  const parsed = visitSchema.safeParse({
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    email: formData.get("email") ?? "",
    remarks: formData.get("remarks") ?? "",
  });
  if (!parsed.success) {
    redirect(`/visit?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const supabase = await createServiceClient();
  const { name, email, remarks } = parsed.data;
  const mobile = normalizeMobile(parsed.data.mobile);

  const { data: existingMember } = await supabase
    .from("members")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  if (existingMember) {
    redirect(`/visit?done=1&already=1&name=${encodeURIComponent(name)}`);
  }

  const { error } = await supabase.from("visitors").insert({ name, mobile, email: email || null, remarks: remarks || null });
  if (error) {
    redirect(`/visit?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/visit?done=1&already=0&name=${encodeURIComponent(name)}`);
}
