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

export interface VisitorRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  remarks: string | null;
  visitedOn: string;
  converted: boolean;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function VisitorsTable({ rows }: { rows: VisitorRow[] }) {
  const currentMonth = monthKey(new Date());
  const availableMonths = Array.from(
    new Set([currentMonth, ...rows.map((r) => monthKey(new Date(r.visitedOn)))])
  ).sort((a, b) => (a < b ? 1 : -1));

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const filtered = rows.filter((r) => monthKey(new Date(r.visitedOn)) === selectedMonth);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Visitor list ({filtered.length})</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {availableMonths.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Visited</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No visitors in {monthLabel(selectedMonth)}.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.name}</TableCell>
                <TableCell className="font-mono">{v.mobile}</TableCell>
                <TableCell>{v.email ?? "—"}</TableCell>
                <TableCell className="max-w-[280px] whitespace-pre-wrap text-sm text-muted-foreground">
                  {v.remarks ?? "—"}
                </TableCell>
                <TableCell>{new Date(v.visitedOn).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  {v.converted ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]">
                      Converted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      Visitor
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
