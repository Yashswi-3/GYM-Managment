"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { activatePendingMember } from "./actions";

export interface PendingMember {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  joinDate: string;
}

function ActivateRow({ member }: { member: PendingMember }) {
  const [error, setError] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState<"yes" | "no">("yes");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("memberId", member.id);
    formData.set("paymentDone", paymentDone);
    startTransition(async () => {
      const result = await activatePendingMember(formData);
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b py-3 last:border-b-0">
      <div className="min-w-[160px]">
        <div className="font-medium">{member.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{member.mobile}</div>
      </div>
      <form action={handleSubmit} className="flex flex-wrap items-center gap-2 flex-1">
        <Input
          name="planName"
          placeholder="Plan (e.g. Monthly)"
          className="flex-1 min-w-[140px] sm:flex-none sm:w-40"
          required
        />
        <Input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount"
          className="flex-1 min-w-[100px] sm:flex-none sm:w-28"
          required
        />
        <Input
          name="validUntil"
          type="date"
          className="flex-1 min-w-[140px] sm:flex-none sm:w-40"
          required
        />
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={paymentDone === "yes" ? "default" : "secondary"}
            onClick={() => setPaymentDone("yes")}
          >
            Payment Done
          </Button>
          <Button
            type="button"
            size="sm"
            variant={paymentDone === "no" ? "default" : "secondary"}
            onClick={() => setPaymentDone("no")}
          >
            Payment Not Done
          </Button>
        </div>
        <Button type="submit" size="sm" loading={isPending}>
          {isPending ? "Activating..." : "Activate"}
        </Button>
      </form>
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

export default function PendingSignups({ members }: { members: PendingMember[] }) {
  if (members.length === 0) return null;

  return (
    <Card className="p-4 border-border/60">
      <h2 className="font-semibold mb-1">
        Pending signups <span className="text-muted-foreground font-normal">({members.length})</span>
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        Self-registered via the join QR. Add a plan, amount, and valid-until date to activate.
      </p>
      <div>
        {members.map((m) => (
          <ActivateRow key={m.id} member={m} />
        ))}
      </div>
    </Card>
  );
}
