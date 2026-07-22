"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Submit button for forms bound directly to a server action (action={fn}).
 * useFormStatus only works when JS has loaded — that's fine, it's a nice-to
 * -have spinner on top of a submission path that already works without it
 * via a plain HTML POST.
 */
export function FormSubmitButton({
  label,
  pendingLabel,
  className,
  size = "lg",
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} size={size} className={className}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
