"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { IndianRupee, TriangleAlert } from "lucide-react";
import { inr, monthKey, monthLabel, currentMonthKey, recentMonthKeys } from "@/lib/money";

export interface PaymentRow {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  paidOn: string;
  validUntil: string;
  /** False means the row records what is owed, not money that changed hands. */
  collected: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN");
}

/**
 * Every total on this page counts only `collected` rows. A payment row with
 * collected=false is a record of what is owed — an activation entered as
 * "Payment Not Done" writes one. Summing all rows is precisely the bug that
 * made "Paid this month" wrong in the optimistic direction, so it is worth
 * being explicit: money in, and money owed, are never added together here.
 */
export default function MoneyTab({ payments }: { payments: PaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string>("all");

  const thisMonth = currentMonthKey();

  const { owed, totals, months, maxMonthTotal } = useMemo(() => {
    const collected = payments.filter((p) => p.collected);
    const owed = payments.filter((p) => !p.collected);

    const byMonth = new Map<string, number>();
    for (const p of collected) {
      const k = monthKey(p.paidOn);
      byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount);
    }

    const lastMonthKey = recentMonthKeys(2)[0];
    const totals = {
      thisMonth: byMonth.get(thisMonth) ?? 0,
      lastMonth: byMonth.get(lastMonthKey) ?? 0,
      allTime: collected.reduce((sum, p) => sum + p.amount, 0),
      owed: owed.reduce((sum, p) => sum + p.amount, 0),
    };

    const months = recentMonthKeys(6).map((k) => ({
      key: k,
      label: monthLabel(k),
      total: byMonth.get(k) ?? 0,
    }));

    return {
      owed,
      totals,
      months,
      maxMonthTotal: Math.max(1, ...months.map((m) => m.total)),
    };
  }, [payments, thisMonth]);

  // Months that actually have payments, newest first — a dropdown of empty
  // months is a dropdown of dead ends.
  const monthOptions = useMemo(() => {
    const keys = [...new Set(payments.map((p) => monthKey(p.paidOn)))];
    return keys.sort().reverse();
  }, [payments]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => (month === "all" ? true : monthKey(p.paidOn) === month))
      .filter((p) => (q ? p.memberName.toLowerCase().includes(q) : true))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  }, [payments, month, search]);

  const headline = [
    { label: "Collected this month", value: totals.thisMonth, tone: "primary" as const },
    { label: "Last month", value: totals.lastMonth, tone: "muted" as const },
    { label: "All time", value: totals.allTime, tone: "muted" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Three stacked full-width cards cost 300px before any content on a
          phone. The headline number keeps the full width; the two reference
          numbers sit beside each other, because they are read as a pair. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {headline.map((h) => (
          <Card
            key={h.label}
            className={`p-4 border-border/60 gap-1 ${
              h.tone === "primary" ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <div className="text-xs text-muted-foreground">{h.label}</div>
            <div
              className={`text-2xl font-display font-semibold ${
                h.tone === "primary" ? "text-primary" : ""
              }`}
            >
              {inr(h.value)}
            </div>
          </Card>
        ))}
      </div>

      {/* Money you are owed is never folded into the totals above. */}
      {owed.length > 0 && (
        <Card className="p-4 border-destructive/40 gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert className="size-4 text-destructive" />
            {inr(totals.owed)} recorded but not collected
          </div>
          <div className="text-xs text-muted-foreground">
            {owed.length === 1 ? "One member has" : `${owed.length} members have`} a payment on file
            that you marked as not taken. It is not counted in any total above.
          </div>
        </Card>
      )}

      <Card className="p-4 border-border/60 gap-3">
        <div className="text-sm font-medium">Last 6 months</div>
        <div className="space-y-2">
          {months.map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <div className="w-16 shrink-0 text-xs text-muted-foreground">
                {m.label.split(" ")[0]}
              </div>
              {/* A div with a width percentage. A chart library for six bars
                  would be more code than the bars. */}
              <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded ${m.key === thisMonth ? "bg-primary" : "bg-primary/40"}`}
                  style={{ width: `${(m.total / maxMonthTotal) * 100}%` }}
                />
              </div>
              <div className="w-20 shrink-0 text-right text-xs tabular-nums">
                {m.total ? inr(m.total) : "—"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            Payments{" "}
            <span className="text-muted-foreground font-normal">({visible.length})</span>
          </h2>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <Input
              className="w-full sm:w-52"
              placeholder="Search by member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="all">Every month</option>
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {monthLabel(k)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Desktop: table. Mobile: stacked cards — same split as Members. */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Paid on</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Covers until</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {payments.length === 0 ? "No payments yet." : "No payments match."}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.memberName}</TableCell>
                    <TableCell>{fmtDate(p.paidOn)}</TableCell>
                    <TableCell className="tabular-nums">{inr(p.amount)}</TableCell>
                    <TableCell>{fmtDate(p.validUntil)}</TableCell>
                    <TableCell>
                      <PaymentBadge collected={p.collected} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden space-y-3">
          {visible.length === 0 ? (
            <Card className="p-4 border-border/60 text-center text-sm text-muted-foreground">
              {payments.length === 0 ? "No payments yet." : "No payments match."}
            </Card>
          ) : (
            visible.map((p) => (
              <Card key={p.id} className="p-4 border-border/60 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.memberName}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.paidOn)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-semibold tabular-nums">{inr(p.amount)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Covers until {fmtDate(p.validUntil)}
                  </span>
                  <PaymentBadge collected={p.collected} />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Totals count only money you marked as taken, by the date on the payment. How it was paid
        (cash, UPI, card) is not recorded anywhere yet.
      </p>
    </div>
  );
}

function PaymentBadge({ collected }: { collected: boolean }) {
  return collected ? (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[oklch(0.75_0.12_145_/_0.18)] text-[oklch(0.8_0.15_145)]">
      Taken
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive">
      Not taken
    </span>
  );
}

/** The Overview card. Same numbers, one line, taps through to this tab. */
export function MoneyCard({ payments, onOpen }: { payments: PaymentRow[]; onOpen: () => void }) {
  const thisMonth = currentMonthKey();
  const lastMonth = recentMonthKeys(2)[0];

  const { total, count, lastTotal } = useMemo(() => {
    let total = 0;
    let count = 0;
    let lastTotal = 0;
    for (const p of payments) {
      if (!p.collected) continue;
      const k = monthKey(p.paidOn);
      if (k === thisMonth) {
        total += p.amount;
        count++;
      } else if (k === lastMonth) {
        lastTotal += p.amount;
      }
    }
    return { total, count, lastTotal };
  }, [payments, thisMonth, lastMonth]);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="p-4 border-border/60 gap-1 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-center gap-2">
        <IndianRupee className="size-4 text-primary" />
        <span className="text-xs text-muted-foreground">Collected this month</span>
      </div>
      <div className="text-3xl font-display font-semibold">{inr(total)}</div>
      <div className="text-xs text-muted-foreground">
        {count === 0
          ? "No payments taken yet this month."
          : `${count} ${count === 1 ? "payment" : "payments"} · ${inr(lastTotal)} last month`}
      </div>
    </Card>
  );
}
