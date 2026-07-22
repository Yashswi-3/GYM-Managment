"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { updatePaymentDate } from "./actions";

export interface PaymentRow {
  id: string;
  memberId: string;
  memberName: string;
  memberMobile: string;
  amount: number;
  paidOn: string;
  validUntil: string;
}

function PaymentEditRow({ row }: { row: PaymentRow }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updatePaymentDate(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <TableRow>
      <TableCell>{row.memberName}</TableCell>
      <TableCell className="font-mono">{row.memberMobile}</TableCell>
      <TableCell>{row.amount}</TableCell>
      <TableCell>
        <form action={handleSubmit} className="flex items-center gap-2">
          <input type="hidden" name="paymentId" value={row.id} />
          <Input name="newPaidOn" type="date" defaultValue={row.paidOn} className="max-w-[160px]" required />
          <Button type="submit" size="sm" loading={isPending}>
            Save
          </Button>
        </form>
        {success && <div className="mt-1 text-xs text-[oklch(0.8_0.15_145)]">Updated.</div>}
        {error && <Alert variant="destructive" className="mt-2">{error}</Alert>}
      </TableCell>
      <TableCell>{new Date(row.validUntil).toLocaleDateString()}</TableCell>
    </TableRow>
  );
}

export default function PaymentHistoryTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="p-4 border-border/60">
      <h2 className="font-semibold mb-1">Payment history / activation dates</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Adjust the paid-on date for any payment if you need to correct when a member was activated.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Paid on</TableHead>
            <TableHead>Valid until</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <PaymentEditRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}