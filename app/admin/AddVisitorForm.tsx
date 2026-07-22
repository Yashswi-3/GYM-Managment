"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { addVisitorManually } from "./actions";

export default function AddVisitorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await addVisitorManually(formData);
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
      <h2 className="font-semibold mb-3">Add a visitor manually</h2>
      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input name="name" placeholder="Name" required />
          <Input name="mobile" placeholder="Mobile" required />
          <Input name="email" type="email" placeholder="Email (optional)" />
        </div>
        <Textarea name="remarks" placeholder="Remarks / notes (optional)" rows={2} className="w-full" />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isPending}>
            {isPending ? "Saving..." : "Add visitor"}
          </Button>
          {success && <span className="text-sm text-[oklch(0.8_0.15_145)]">Added.</span>}
        </div>
      </form>
      {error && <Alert variant="destructive" className="mt-2">{error}</Alert>}
    </Card>
  );
}
