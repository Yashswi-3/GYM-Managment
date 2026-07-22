"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { addMemberWithPayment } from "./actions";

export default function AddMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await addMemberWithPayment(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
      formRef.current?.reset();
    });
  }

  return (
    <Card className="p-4 border-border/60">
      <h2 className="font-semibold mb-3">Add member / record payment</h2>
      <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Input name="name" placeholder="Name" required />
        <Input name="mobile" placeholder="Mobile" required />
        <Input name="email" type="email" placeholder="Email (for notifications)" />
        <Input name="planName" placeholder="Plan (e.g. Monthly)" required />
        <Input name="amount" type="number" step="0.01" placeholder="Amount" required />
        <Input name="validUntil" type="date" required />
        <div className="md:col-span-6 flex items-center gap-3">
          <Button type="submit" loading={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
          {error && <Alert variant="destructive">{error}</Alert>}
          {success && <span className="text-sm text-[oklch(0.8_0.15_145)]">Saved.</span>}
        </div>
      </form>
      <p className="text-xs text-muted-foreground mt-2">
        If the mobile number already belongs to a member, this records a renewal payment
        instead of creating a duplicate. If it matches an unconverted visitor, that visitor
        is linked to the new member automatically.
      </p>
    </Card>
  );
}
