"use client";

import { useState, useTransition, type ReactNode } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  setMemberActiveOverride,
  updateMember,
  deleteMember,
  recordPayment,
  setMemberRejected,
} from "./actions";
import type { MemberRow } from "./MembersTable";
import { type MemberStatus } from "@/lib/status";
import PlanDuration from "./PlanDuration";

type Layout = "row" | "card";

/**
 * Every row used to carry four buttons and a caption — Take payment, Mark not
 * paid, Edit, Delete, plus "Based on their last payment." repeated on all of
 * them. That is not four decisions, it is two: the owner is either handling
 * money or correcting a record. The buttons were grouped by what the server
 * actions can do rather than by what the owner came here to do.
 *
 * So: two buttons. Fees owns everything about money (take a payment, or flag
 * one that bounced). Edit owns everything about the record (the fields, and
 * Delete, which is destructive and belongs behind a deliberate step rather
 * than sitting in red on all thirty rows at once).
 */

const statusStyles: Record<MemberStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  rejected: "bg-muted text-muted-foreground line-through",
  active: "bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]",
  expiring_soon: "bg-[oklch(0.8_0.16_85_/_0.18)] text-[oklch(0.85_0.16_85)]",
  expired: "bg-destructive/15 text-destructive",
  inactive: "bg-muted text-muted-foreground border border-border/60",
};

// Plain words, not system words. The owner has no technical background and
// reads this on a phone: "Payment Incomplete" is a state name, "Not paid" is
// a fact about a person. Note this splits what used to be one bucket —
// "Ends soon" was previously folded into "Payment Incomplete", but it needs a
// different action from the owner (remind, not chase) so it gets its own word.
const statusLabels: Record<MemberStatus, string> = {
  pending: "Waiting for your OK",
  rejected: "Rejected",
  active: "Paid",
  expiring_soon: "Ends soon",
  expired: "Not paid",
  inactive: "Not paid",
};

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN") : "—";
}

function StatusBadge({ member }: { member: MemberRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[member.status]}`}>
        {statusLabels[member.status]}
      </span>
      {/* Only when the owner actually forced it. The old caption said "Based
          on their last payment." under every single row, which is the default
          and therefore tells you nothing — thirty copies of a sentence that
          only matters in the other case. */}
      {member.isActiveOverride === false && (
        <span className="text-[11px] text-muted-foreground">set by you</span>
      )}
    </span>
  );
}

/**
 * Everything about money for one member. "Mark not paid" lives here rather
 * than in its own column because it is a statement about payment, and the
 * owner reaching for it is already thinking about this member's fees.
 */
function FeesPanel({
  member,
  layout,
  onDone,
}: {
  member: MemberRow;
  layout: Layout;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stack = layout === "card";
  const forcedNotPaid = member.isActiveOverride === false;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("memberId", member.id);
    startTransition(async () => {
      const result = await recordPayment(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onDone();
    });
  }

  // The action has always accepted "auto", but nothing ever sent it — so a
  // mis-tapped "Mark not paid" could only be undone by recording a payment
  // that never happened. That is the one bug in here that could put a wrong
  // number in the books.
  function toggleNotPaid() {
    setError(null);
    const formData = new FormData();
    formData.set("memberId", member.id);
    formData.set("statusOverride", forcedNotPaid ? "auto" : "inactive");
    startTransition(async () => {
      const result = await setMemberActiveOverride(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Fees — {member.name}</div>

      <form action={handleSubmit} className={stack ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-2"}>
        <label className={stack ? "w-full" : "w-full md:w-auto"}>
          <span className="block text-[11px] text-muted-foreground mb-1">Amount</span>
          <Input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Amount"
            defaultValue={member.amount ?? ""}
            className={stack ? "w-full" : "w-full md:w-28"}
            required
          />
        </label>
        <PlanDuration stack={stack} />
        <div className={stack ? "flex gap-2" : "flex gap-2 md:self-end md:pb-0.5"}>
          <Button type="submit" size="sm" loading={isPending} className={stack ? "flex-1" : undefined}>
            {isPending ? "Saving..." : "Save payment"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onDone}
            className={stack ? "flex-1" : undefined}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="border-t pt-3">
        <Button
          type="button"
          size="sm"
          variant={forcedNotPaid ? "secondary" : "ghost"}
          loading={isPending}
          onClick={toggleNotPaid}
          className={`text-muted-foreground ${stack ? "w-full" : ""}`}
        >
          {forcedNotPaid ? "Undo — they have paid" : "Mark as not paid"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {forcedNotPaid
            ? "You flagged this one. Saving a payment above clears it too."
            : "For a payment that bounced before their end date — otherwise the dates handle it."}
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

// Shared edit form — identical fields/inputs for both layouts, only the
// container direction and input widths change (compact wrap on desktop,
// full-width stack in a mobile card). Delete lives at the bottom: it is the
// one thing here that cannot be undone, so it sits below a divider rather
// than beside Save, and still asks twice.
function EditForm({
  member,
  layout,
  isPending,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: {
  member: MemberRow;
  layout: Layout;
  isPending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stack = layout === "card";
  const grow = stack ? "w-full" : "flex-1 min-w-[120px]";
  const dateW = stack ? "w-full" : "w-40";
  return (
    <>
      <div className="text-sm font-medium mb-3">Edit — {member.name}</div>
      <form action={onSubmit} className={stack ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
        {member.paymentId && <input type="hidden" name="paymentId" value={member.paymentId} />}
        <Input name="name" defaultValue={member.name} placeholder="Name" className={grow} required />
        <Input name="mobile" defaultValue={member.mobile} placeholder="Mobile" className={grow} required />
        <Input name="email" defaultValue={member.email ?? ""} placeholder="Email" className={grow} />
        <Input name="planName" defaultValue={member.planName} placeholder="Plan" className={grow} required />
        {member.paymentId && (
          <>
            <Input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={member.amount ?? ""}
              placeholder="Amount"
              className={stack ? "w-full" : "w-28"}
              required
            />
            <Input name="paidOn" type="date" defaultValue={member.paidOn ?? ""} className={dateW} required />
            <Input name="validUntil" type="date" defaultValue={member.validUntil ?? ""} className={dateW} required />
          </>
        )}
        <div className={stack ? "flex gap-2" : "flex gap-2"}>
          <Button type="submit" size="sm" loading={isPending} className={stack ? "flex-1" : undefined}>
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onCancel}
            className={stack ? "flex-1" : undefined}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="border-t mt-3 pt-3">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Delete {member.name} and their payment history? This cannot be undone.
            </span>
            <Button type="button" size="sm" variant="destructive" loading={isPending} onClick={onDelete}>
              {isPending ? "Deleting..." : "Yes, delete"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete this member
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-2">
          {error}
        </Alert>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default function MemberRowItem({
  member,
  layout = "row",
}: {
  member: MemberRow;
  layout?: Layout;
}) {
  const [editing, setEditing] = useState(false);
  const [openingFees, setOpeningFees] = useState(false);
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
      if (!result.ok) setError(result.error ?? "Could not delete");
    });
  }

  // Undo for Reject. Nothing was destroyed, so this is just clearing the flag.
  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("memberId", member.id);
      fd.set("rejected", "no");
      const result = await setMemberRejected(fd);
      if (!result.ok) setError(result.error ?? "Could not restore");
    });
  }

  // --- Edit + Fees are shared between layouts; only the wrapper differs. ---
  if (editing) {
    const form = (
      <EditForm
        member={member}
        layout={layout}
        isPending={isPending}
        error={error}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        onCancel={() => {
          setEditing(false);
          setError(null);
        }}
      />
    );
    return layout === "card" ? (
      <Card className="p-4 border-border/60">{form}</Card>
    ) : (
      <TableRow>
        <TableCell colSpan={10} className="py-3">
          {form}
        </TableCell>
      </TableRow>
    );
  }

  if (openingFees) {
    const panel = <FeesPanel member={member} layout={layout} onDone={() => setOpeningFees(false)} />;
    return layout === "card" ? (
      <Card className="p-4 border-border/60">{panel}</Card>
    ) : (
      <TableRow>
        <TableCell colSpan={10} className="py-3">
          {panel}
        </TableCell>
      </TableRow>
    );
  }

  const lastSeenValue = member.lastSeen ? (
    <>
      {fmtDate(member.lastSeen)}
      {member.inactive7 && <span className="ml-1 text-xs text-destructive">(inactive)</span>}
    </>
  ) : (
    <span className="text-destructive">Never</span>
  );

  // A signup nobody has approved has no payment to collect against, and
  // recordPayment does not approve anybody — so offering Fees here would take
  // the owner's money entry and still leave the member unable to check in.
  // Approving is the "Waiting for your OK" panel's job. This is also what put
  // "Mark not paid" on rows that had never paid anything.
  const canTakeFees = member.status !== "pending" && member.status !== "rejected";

  const actions = (
    <>
      {canTakeFees && (
        <Button size="sm" onClick={() => setOpeningFees(true)} className={layout === "card" ? "flex-1" : undefined}>
          Fees
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setEditing(true)}
        className={layout === "card" ? "flex-1" : undefined}
      >
        Edit
      </Button>
      {member.status === "rejected" && (
        <Button
          size="sm"
          variant="secondary"
          loading={isPending}
          onClick={handleRestore}
          className={layout === "card" ? "flex-1" : undefined}
        >
          Restore
        </Button>
      )}
    </>
  );

  // --- Mobile card ---
  if (layout === "card") {
    return (
      // Card is `flex flex-col gap-6`, so a `space-y-3` here does not replace
      // that 24px gap — it adds 12px of margin on top of it. Every card was
      // carrying 36px of dead space between each block. Set the flex gap.
      <Card className="p-4 border-border/60 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{member.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{member.mobile}</div>
          </div>
          <StatusBadge member={member} />
        </div>

        {/* Someone with no payment on file had four facts reading "—" — half
            the card saying nothing. The table keeps its dashes because columns
            have to line up; a card has no such excuse. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {member.paymentId && (
            <>
              <Fact label="Plan" value={member.planName} />
              <Fact label="Amount" value={member.amount != null ? member.amount : "—"} />
              <Fact label="Paid on" value={fmtDate(member.paidOn)} />
              <Fact label="Ends on" value={fmtDate(member.validUntil)} />
            </>
          )}
          <Fact label="Last visit" value={lastSeenValue} />
          <Fact label="Member for" value={`${member.tenureDays} days`} />
        </div>

        <div className="flex gap-2">{actions}</div>

        {error && (
          <Alert variant="destructive" className="text-left">
            {error}
          </Alert>
        )}
      </Card>
    );
  }

  // --- Desktop table row ---
  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell className="font-mono">{member.mobile}</TableCell>
      <TableCell>{member.planName}</TableCell>
      <TableCell>{member.amount != null ? member.amount : "—"}</TableCell>
      <TableCell>{fmtDate(member.paidOn)}</TableCell>
      <TableCell>
        <StatusBadge member={member} />
      </TableCell>
      <TableCell>{fmtDate(member.validUntil)}</TableCell>
      <TableCell>{member.tenureDays}d</TableCell>
      <TableCell>{lastSeenValue}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex justify-end gap-1">{actions}</div>
        {error && (
          <Alert variant="destructive" className="mt-2 text-left">
            {error}
          </Alert>
        )}
      </TableCell>
    </TableRow>
  );
}
