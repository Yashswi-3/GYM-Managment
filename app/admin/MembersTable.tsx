"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { MemberStatus } from "@/lib/status";

export interface MemberRow {
  id: string;
  name: string;
  mobile: string;
  joinDate: string;
  planName: string;
  validUntil: string | null;
  status: MemberStatus;
  tenureDays: number;
  lastSeen: string | null;
  inactive7: boolean;
}

const statusStyles: Record<MemberStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]",
  expiring_soon: "bg-primary/15 text-primary",
  expired: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<MemberStatus, string> = {
  pending: "Pending signup",
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

export default function MembersTable({ rows }: { rows: MemberRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.mobile.includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Members</h2>
        <Input
          className="max-w-xs"
          placeholder="Search by name or mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No members yet.
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
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
