"use client";

import { useState, useTransition } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { setMemberActiveOverride, updateMember, deleteMember, recordPayment } from "./actions";
import type { MemberRow } from "./MembersTable";
import type { MemberStatus } from "@/lib/status";

const statusStyles: Record<MemberStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]",
  expiring_soon: "bg-primary/15 text-primary",
  expired: "bg-destructive/15 text-destructive",
  inactive: "bg-muted text-muted-foreground border border-border/60",
};

// Payment-workflow wording: Active reads as "Payment Complete"; anything
// that isn't currently paid up (due soon, overdue, or force-marked
// incomplete) all read the same "Payment Incomplete" so the table answers
// one question at a glance — has this person paid or not.
const statusLabels: Record<MemberStatus, string> = {
  pending: "Pending signup",
  active: "Payment Complete",
  expiring_soon: "Payment Incomplete",
  expired: "Payment Incomplete",
  inactive: "Payment Incomplete",
};

function MemberOverrideControls({ member, onRenew }: { member: MemberRow; onRenew: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // There's no "Auto" button — auto is just what happens when nothing is
  // forced. Renew (an actual payment) is what naturally returns a member
  // to Payment Complete; Payment Incomplete is the only manual override,
  // for flagging a real problem (e.g. a bounced payment) ahead of the
  // calendar, and it's cleared automatically the next time Renew runs.
  const forcedIncomplete = member.isActiveOverride === false;

  function forceIncomplete() {
    setError(null);
    const formData = new FormData();
    formData.set("memberId", member.id);
    formData.set("statusOverride", "inactive");

    startTransition(async () => {
      const result = await setMemberActiveOverride(formData);
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {member.paymentId && (
          <Button type="button" size="sm" variant="secondary" onClick={onRenew}>
            Renew
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={forcedIncomplete ? "default" : "secondary"}
          onClick={forceIncomplete}
          loading={isPending}
        >
          Payment Incomplete
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {forcedIncomplete ? "Forced incomplete by admin." : "Derived from latest payment."}
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

function RenewForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("memberId", memberId);
    startTransition(async () => {
      const result = await recordPayment(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onDone();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
      <Input name="amount" type="number" step="0.01" placeholder="Amount" className="w-28" required />
      <Input name="validUntil" type="date" className="w-40" required />
      <Button type="submit" size="sm" loading={isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onDone}>
        Cancel
      </Button>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}

export default function MemberRowItem({ member }: { member: MemberRow }) {
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    setError(null);
    formData.set("memberId", member.id);
    startTransition(async () => {
      const result = await updateMember(formData);
      if (!result.ok) setError(result.error ?? "Something went wrong");
      else setEditing(false);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("memberId", member.id);
      const result = await deleteMember(fd);
      // On success the row just disappears once the parent list re-renders
      // (revalidatePath already refreshes the admin page's data).
      if (!result.ok) {
        setError(result.error ?? "Could not delete");
        setConfirmDelete(false);
      }
    });
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="py-3">
          <form action={handleUpdate} className="flex flex-wrap items-center gap-2">
            {member.paymentId && <input type="hidden" name="paymentId" value={member.paymentId} />}
            <Input name="name" defaultValue={member.name} placeholder="Name" className="flex-1 min-w-[120px]" required />
            <Input name="mobile" defaultValue={member.mobile} placeholder="Mobile" className="flex-1 min-w-[120px]" required />
            <Input name="email" defaultValue={member.email ?? ""} placeholder="Email" className="flex-1 min-w-[140px]" />
            <Input name="planName" defaultValue={member.planName} placeholder="Plan" className="flex-1 min-w-[100px]" required />
            {member.paymentId && (
              <>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={member.amount ?? ""}
                  placeholder="Amount"
                  className="w-28"
                  required
                />
                <Input name="paidOn" type="date" defaultValue={member.paidOn ?? ""} className="w-40" required />
                <Input name="validUntil" type="date" defaultValue={member.validUntil ?? ""} className="w-40" required />
              </>
            )}
            <Button type="submit" size="sm" loading={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-2">
              {error}
            </Alert>
          )}
        </TableCell>
      </TableRow>
    );
  }

  if (renewing) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="py-3">
          <RenewForm memberId={member.id} onDone={() => setRenewing(false)} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell className="font-mono">{member.mobile}</TableCell>
      <TableCell>{member.planName}</TableCell>
      <TableCell>{member.amount != null ? member.amount : "—"}</TableCell>
      <TableCell>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[member.status]}`}>
          {statusLabels[member.status]}
        </span>
      </TableCell>
      <TableCell>{member.validUntil ? new Date(member.validUntil).toLocaleDateString("en-IN") : "—"}</TableCell>
      <TableCell>{member.tenureDays}d</TableCell>
      <TableCell>
        {member.lastSeen ? (
          new Date(member.lastSeen).toLocaleDateString("en-IN")
        ) : (
          <span className="text-destructive">Never</span>
        )}
        {member.inactive7 && <span className="ml-1 text-xs text-destructive">(inactive)</span>}
      </TableCell>
      <TableCell>
        <MemberOverrideControls member={member} onRenew={() => setRenewing(true)} />
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmDelete ? (
            <Button size="sm" variant="destructive" loading={isPending} onClick={handleDelete}>
              {isPending ? "Deleting..." : "Confirm?"}
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
        {error && (
          <Alert variant="destructive" className="mt-2 text-left">
            {error}
          </Alert>
        )}
      </TableCell>
    </TableRow>
  );
}
