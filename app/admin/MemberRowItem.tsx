"use client";

import { useState, useTransition } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { setMemberActiveOverride, updateMember, deleteMember } from "./actions";
import type { MemberRow } from "./MembersTable";
import type { MemberStatus } from "@/lib/status";

const statusStyles: Record<MemberStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]",
  expiring_soon: "bg-primary/15 text-primary",
  expired: "bg-destructive/15 text-destructive",
  inactive: "bg-muted text-muted-foreground border border-border/60",
};

const statusLabels: Record<MemberStatus, string> = {
  pending: "Pending signup",
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  inactive: "Inactive",
};

function MemberOverrideControls({ member }: { member: MemberRow }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(statusOverride: "active" | "inactive" | "auto") {
    setError(null);
    const formData = new FormData();
    formData.set("memberId", member.id);
    formData.set("statusOverride", statusOverride);

    startTransition(async () => {
      const result = await setMemberActiveOverride(formData);
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  const current =
    member.isActiveOverride === true ? "active" : member.isActiveOverride === false ? "inactive" : "auto";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={current === "auto" ? "default" : "secondary"}
          onClick={() => submit("auto")}
          loading={isPending}
        >
          Auto
        </Button>
        <Button
          type="button"
          size="sm"
          variant={current === "active" ? "default" : "secondary"}
          onClick={() => submit("active")}
          loading={isPending}
        >
          Active
        </Button>
        <Button
          type="button"
          size="sm"
          variant={current === "inactive" ? "default" : "secondary"}
          onClick={() => submit("inactive")}
          loading={isPending}
        >
          Inactive
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {current === "auto" ? "Derived from latest payment." : `Forced ${current}.`}
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

export default function MemberRowItem({ member }: { member: MemberRow }) {
  const [editing, setEditing] = useState(false);
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
        <TableCell colSpan={9} className="py-3">
          <form action={handleUpdate} className="flex flex-wrap items-center gap-2">
            <Input name="name" defaultValue={member.name} placeholder="Name" className="flex-1 min-w-[120px]" required />
            <Input name="mobile" defaultValue={member.mobile} placeholder="Mobile" className="flex-1 min-w-[120px]" required />
            <Input name="email" defaultValue={member.email ?? ""} placeholder="Email" className="flex-1 min-w-[140px]" />
            <Input name="planName" defaultValue={member.planName} placeholder="Plan" className="flex-1 min-w-[100px]" required />
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

  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell className="font-mono">{member.mobile}</TableCell>
      <TableCell>{member.planName}</TableCell>
      <TableCell>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[member.status]}`}>
          {statusLabels[member.status]}
        </span>
      </TableCell>
      <TableCell>{member.validUntil ? new Date(member.validUntil).toLocaleDateString() : "—"}</TableCell>
      <TableCell>{member.tenureDays}d</TableCell>
      <TableCell>
        {member.lastSeen ? (
          new Date(member.lastSeen).toLocaleDateString()
        ) : (
          <span className="text-destructive">Never</span>
        )}
        {member.inactive7 && <span className="ml-1 text-xs text-destructive">(inactive)</span>}
      </TableCell>
      <TableCell>
        <MemberOverrideControls member={member} />
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
