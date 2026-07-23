"use client";

import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MemberStatus } from "@/lib/status";
import MemberRowItem from "./MemberRowItem";

export interface MemberRow {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  joinDate: string;
  planName: string;
  // The latest payment on file, if any (a pending signup with zero payments
  // has none yet) — carried here so Edit can correct amount/dates in the
  // same form as the member's own details, with no separate payment table.
  paymentId: string | null;
  amount: number | null;
  paidOn: string | null;
  validUntil: string | null;
  isActiveOverride: boolean | null;
  status: MemberStatus;
  tenureDays: number;
  lastSeen: string | null;
  inactive7: boolean;
  paidThisMonth: boolean;
}

export type MemberFilter = "all" | "paid" | "unpaid";

const filterLabels: Record<MemberFilter, string> = {
  all: "All",
  paid: "Paid this month",
  unpaid: "Unpaid this month",
};

export default function MembersTable({
  rows,
  filter,
  onFilterChange,
}: {
  rows: MemberRow[];
  filter: MemberFilter;
  onFilterChange: (filter: MemberFilter) => void;
}) {
  const [search, setSearch] = useState("");

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
            onClick={() => onFilterChange(f)}
            className={cn(filter === f && "pointer-events-none")}
          >
            {filterLabels[f]}
          </Button>
        ))}
      </div>
      {/* Desktop: full table. Mobile: stacked cards (a wide table would just
          horizontal-scroll on a phone, hiding name/status/actions). */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid on</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Tenure</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  {rows.length === 0 ? "No members yet." : "No members match this filter."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => <MemberRowItem key={m.id} member={m} layout="row" />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {rows.length === 0 ? "No members yet." : "No members match this filter."}
          </p>
        ) : (
          filtered.map((m) => <MemberRowItem key={m.id} member={m} layout="card" />)
        )}
      </div>
    </div>
  );
}
