"use client";

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
  visitedOn: string;
  converted: boolean;
}

export default function VisitorsTable({ rows }: { rows: VisitorRow[] }) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Visitor list ({rows.length})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Visited</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No visitors yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.name}</TableCell>
                <TableCell className="font-mono">{v.mobile}</TableCell>
                <TableCell>{v.email ?? "—"}</TableCell>
                <TableCell>{new Date(v.visitedOn).toLocaleDateString()}</TableCell>
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
