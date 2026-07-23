"use client";

import { useState, useTransition, type ReactNode } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { setMemberActiveOverride, updateMember, deleteMember, recordPayment } from "./actions";
import type { MemberRow } from "./MembersTable";
import { oneMonthFromToday, type MemberStatus } from "@/lib/status";

type Layout = "row" | "card";

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

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN") : "—";
}

function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

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

function RenewForm({ memberId, layout, onDone }: { memberId: string; layout: Layout; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stack = layout === "card";

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
    <form action={handleSubmit} className={stack ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
      <Input
        name="amount"
        type="number"
        step="0.01"
        placeholder="Amount"
        className={stack ? "w-full" : "w-28"}
        required
      />
      <Input
        name="validUntil"
        type="date"
        defaultValue={oneMonthFromToday()}
        className={stack ? "w-full" : "w-40"}
        required
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}

// Shared edit form — identical fields/inputs for both layouts, only the
// container direction and input widths change (compact wrap on desktop,
// full-width stack in a mobile card).
function EditForm({
  member,
  layout,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  member: MemberRow;
  layout: Layout;
  isPending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const stack = layout === "card";
  const grow = stack ? "w-full" : "flex-1 min-w-[120px]";
  const dateW = stack ? "w-full" : "w-40";
  return (
    <>
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
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
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

  // --- Edit + Renew are shared between layouts; only the wrapper differs. ---
  if (editing) {
    const form = (
      <EditForm
        member={member}
        layout={layout}
        isPending={isPending}
        error={error}
        onSubmit={handleUpdate}
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
        <TableCell colSpan={11} className="py-3">
          {form}
        </TableCell>
      </TableRow>
    );
  }

  if (renewing) {
    const form = <RenewForm memberId={member.id} layout={layout} onDone={() => setRenewing(false)} />;
    return layout === "card" ? (
      <Card className="p-4 border-border/60 space-y-2">
        <div className="text-sm font-medium">Renew — {member.name}</div>
        {form}
      </Card>
    ) : (
      <TableRow>
        <TableCell colSpan={11} className="py-3">
          {form}
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

  // --- Mobile card ---
  if (layout === "card") {
    return (
      <Card className="p-4 border-border/60 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{member.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{member.mobile}</div>
          </div>
          <StatusBadge status={member.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Fact label="Plan" value={member.planName} />
          <Fact label="Amount" value={member.amount != null ? member.amount : "—"} />
          <Fact label="Paid on" value={fmtDate(member.paidOn)} />
          <Fact label="Valid until" value={fmtDate(member.validUntil)} />
          <Fact label="Last seen" value={lastSeenValue} />
          <Fact label="Tenure" value={`${member.tenureDays}d`} />
        </div>

        <MemberOverrideControls member={member} onRenew={() => setRenewing(true)} />

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmDelete ? (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              loading={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting..." : "Confirm?"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
        {error && (
          <Alert variant="destructive" className="text-left">
            {error}
          </Alert>
        )}
      </Card>
    );
  }

  // --- Desktop table row (unchanged) ---
  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell className="font-mono">{member.mobile}</TableCell>
      <TableCell>{member.planName}</TableCell>
      <TableCell>{member.amount != null ? member.amount : "—"}</TableCell>
      <TableCell>{fmtDate(member.paidOn)}</TableCell>
      <TableCell>
        <StatusBadge status={member.status} />
      </TableCell>
      <TableCell>{fmtDate(member.validUntil)}</TableCell>
      <TableCell>{member.tenureDays}d</TableCell>
      <TableCell>{lastSeenValue}</TableCell>
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
