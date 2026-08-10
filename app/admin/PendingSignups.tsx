"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { activatePendingMember, setMemberRejected } from "./actions";
import PlanDuration from "./PlanDuration";

export interface PendingMember {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  joinDate: string;
}

function ActivateRow({
  member,
  defaultAmount,
}: {
  member: PendingMember;
  defaultAmount: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Mis-scans and walk-ins who never came back. Nothing is deleted — the row
  // drops out of this list and shows as Rejected in the Members table, where
  // Restore puts it back. Two taps, because the neighbouring row is a real
  // person and this is a phone.
  function handleReject() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("memberId", member.id);
      fd.set("rejected", "yes");
      const result = await setMemberRejected(fd);
      if (!result.ok) {
        setError(result.error ?? "Could not reject");
        setConfirmReject(false);
      }
    });
  }

  // Approve means they paid. The old Payment Done / Payment Not Done pair
  // lived here too, which made a two-outcome decision look like a four-button
  // one; recording an approval where money did not change hands is what
  // Add member is for.
  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("memberId", member.id);
    startTransition(async () => {
      const result = await activatePendingMember(formData);
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  // Phone: one card per signup — name, then the fields in the order they get
  // answered, then a full-width Approve. Wrapping a row of six controls at
  // 375px put the term dropdown above the name it belonged to. From md up it
  // is the old single line.
  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 md:flex-row md:flex-wrap md:items-center md:gap-2 md:py-3">
      <div className="md:min-w-[160px]">
        <div className="font-medium">{member.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{member.mobile}</div>
      </div>
      <form
        action={handleSubmit}
        className="flex flex-col gap-3 md:grow md:flex-row md:flex-wrap md:items-center md:gap-2"
      >
        <PlanDuration />
        <label className="w-full md:w-auto">
          {/* Labelled, not just placeholdered: the placeholder disappears the
              moment the amount is pre-filled, which it always is. */}
          <span className="block text-[11px] text-muted-foreground mb-1">Amount</span>
          <Input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Amount"
            defaultValue={defaultAmount ?? ""}
            className="w-full md:w-28"
            required
          />
        </label>
        <Button type="submit" size="sm" loading={isPending} className="w-full md:w-auto">
          {isPending ? "Approving..." : "Approve"}
        </Button>
      </form>
      {confirmReject ? (
        <div className="flex gap-2 md:gap-1">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            loading={isPending}
            onClick={handleReject}
            className="flex-1 md:flex-none"
          >
            Reject?
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setConfirmReject(false)}
            className="flex-1 md:flex-none"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirmReject(true)}
          className="w-full text-muted-foreground md:w-auto"
        >
          Reject
        </Button>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

export default function PendingSignups({
  members,
  defaultAmount,
}: {
  members: PendingMember[];
  defaultAmount: number | null;
}) {
  if (members.length === 0) return null;

  return (
    <Card className="p-4 border-border/60">
      <h2 className="font-semibold mb-1">
        Waiting for your OK <span className="text-muted-foreground font-normal">({members.length})</span>
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        {defaultAmount !== null
          ? "They scanned the join QR. Term and last amount are filled in — check them and tap Approve."
          : "They scanned the join QR. Pick a term and amount to approve them."}
      </p>
      <div>
        {members.map((m) => (
          <ActivateRow key={m.id} member={m} defaultAmount={defaultAmount} />
        ))}
      </div>
    </Card>
  );
}
