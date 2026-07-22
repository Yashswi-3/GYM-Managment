"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { MemberStatus } from "@/lib/status";
import { setMemberActiveOverride } from "./actions";

export interface MemberRow {
  id: string;
  name: string;
  mobile: string;
  joinDate: string;
  planName: string;
  validUntil: string | null;
  isActiveOverride: boolean | null;
  status: MemberStatus;
  tenureDays: number;
  lastSeen: string | null;
  inactive7: boolean;
  paidThisMonth: boolean;
}

export type MemberFilter = "all" | "paid" | "unpaid";

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

const filterLabels: Record<MemberFilter, string> = {
  all: "All",
  paid: "Paid this month",
  unpaid: "Unpaid this month",
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

export default function MembersTable({
  rows,
  filter: controlledFilter,
  onFilterChange,
}: {
  rows: MemberRow[];
  /** Pass this + onFilterChange to drive the filter from outside (e.g. a
   * stat card click). Omit both to let the table manage its own filter. */
  filter?: MemberFilter;
  onFilterChange?: (filter: MemberFilter) => void;
}) {
  const [search, setSearch] = useState("");
  const [internalFilter, setInternalFilter] = useState<MemberFilter>("all");
  const filter = controlledFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const filtered = rows.filter((r) => {
    if (filter === "paid" && !r.paidThisMonth) return false;
    if (filter === "unpaid" && r.paidThisMonth) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.mobile.includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Members</h2>
        <Input
          className="w-full sm:w-auto sm:max-w-xs"
          placeholder="Search by name or mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as MemberFilter[]).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "secondary"}
            onClick={() => setFilter(f)}
            className={cn(filter === f && "pointer-events-none")}
          >
            {filterLabels[f]}
          </Button>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Valid until</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead>Override</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {rows.length === 0 ? "No members yet." : "No members match this filter."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.name}</TableCell>
                <TableCell className="font-mono">{m.mobile}</TableCell>
                <TableCell>{m.planName}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[m.status]}`}>
                    {statusLabels[m.status]}
                  </span>
                </TableCell>
                <TableCell>{m.validUntil ? new Date(m.validUntil).toLocaleDateString() : "—"}</TableCell>
                <TableCell>{m.tenureDays}d</TableCell>
                <TableCell>
                  {m.lastSeen ? (
                    new Date(m.lastSeen).toLocaleDateString()
                  ) : (
                    <span className="text-destructive">Never</span>
                  )}
                  {m.inactive7 && <span className="ml-1 text-xs text-destructive">(inactive)</span>}
                </TableCell>
                <TableCell>
                  <MemberOverrideControls member={m} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
