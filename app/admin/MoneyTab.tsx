"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { IndianRupee, CheckCircle2 } from "lucide-react";
import { inr, monthKey, monthLabel, currentMonthKey, recentMonthKeys } from "@/lib/money";
import { computeDues, agingLabel } from "@/lib/dues";
import MemberRowItem from "./MemberRowItem";
import type { MemberRow } from "./MembersTable";

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

type Section = "collect" | "received" | "trend";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN");
}

/**
 * The Fees tab is a **worklist first, a ledger second** — the owner does not
 * come here to read history, he comes here to collect. That is the shape every
 * billing product converges on (Gymdesk: scheduled / received / overdue;
 * Chargebee and Stripe age the overdue into buckets): three totals that never
 * overlap, then a list ordered by who to chase first, with the action on the
 * row.
 *
 * Two rules hold the numbers honest:
 *   1. Money in counts only `collected = true`. A collected=false row records
 *      what is owed — summing all rows is the Phase 1 bug, optimistic again.
 *   2. Money owed is derived from memberships, never from payment rows, so a
 *      member appears in exactly one bucket and totals can be added.
 */
export default function MoneyTab({
  payments,
  members,
}: {
  payments: PaymentRow[];
  members: MemberRow[];
}) {
  const [section, setSection] = useState<Section>("collect");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string>("all");

  const thisMonth = currentMonthKey();
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const dues = useMemo(() => computeDues(members), [members]);

  const { collectedThisMonth, months, maxMonthTotal, allTime } = useMemo(() => {
    const byMonth = new Map<string, number>();
    let collectedThisMonth = 0;
    let allTime = 0;
    for (const p of payments) {
      if (!p.collected) continue;
      const k = monthKey(p.paidOn);
      byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount);
      allTime += p.amount;
      if (k === thisMonth) collectedThisMonth += p.amount;
    }
    const months = recentMonthKeys(6).map((k) => ({
      key: k,
      label: monthLabel(k),
      total: byMonth.get(k) ?? 0,
    }));
    return {
      collectedThisMonth,
      allTime,
      months,
      maxMonthTotal: Math.max(1, ...months.map((m) => m.total)),
    };
  }, [payments, thisMonth]);

  const receivedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => (month === "all" ? true : monthKey(p.paidOn) === month))
      .filter((p) => (q ? p.memberName.toLowerCase().includes(q) : true))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  }, [payments, month, search]);

  const monthOptions = useMemo(
    () => [...new Set(payments.map((p) => monthKey(p.paidOn)))].sort().reverse(),
    [payments]
  );

  const totals = [
    {
      key: "collect" as const,
      label: "Still to collect",
      value: dues.stillToCollect,
      sub: `${dues.notTaken.length + dues.overdue.length} late · ${dues.dueThisMonth.length} due this month`,
      tone: dues.notTaken.length + dues.overdue.length ? "bad" : "warn",
    },
    {
      key: "received" as const,
      label: "Collected this month",
      value: collectedThisMonth,
      sub: `${inr(allTime)} all time`,
      tone: "good",
    },
  ];

  const toneClass = {
    good: "text-[oklch(0.8_0.15_145)]",
    warn: "text-[oklch(0.85_0.16_85)]",
    bad: "text-destructive",
  } as const;

  const sections: { id: Section; label: string; count?: number }[] = [
    {
      id: "collect",
      label: "To collect",
      count: dues.notTaken.length + dues.overdue.length + dues.dueThisMonth.length,
    },
    { id: "received", label: "Received", count: payments.filter((p) => p.collected).length },
    { id: "trend", label: "Trend" },
  ];

  return (
    <div className="space-y-6">
      {/* The two numbers that decide what he does next. Owed first: money in
          is yesterday's news, money out there is today's job. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {totals.map((t) => (
          <Card
            key={t.key}
            role="button"
            tabIndex={0}
            onClick={() => setSection(t.key)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") setSection(t.key);
            }}
            className="p-4 border-border/60 gap-1 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div
              className={`text-3xl font-display font-semibold ${
                toneClass[t.tone as keyof typeof toneClass]
              }`}
            >
              {inr(t.value)}
            </div>
            <div className="text-xs text-muted-foreground">{t.sub}</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 border-b border-border/60 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              section === s.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
            {s.count !== undefined && (
              <span className="text-muted-foreground font-normal"> ({s.count})</span>
            )}
          </button>
        ))}
      </div>

      {section === "collect" && (
        <CollectList dues={dues} memberById={memberById} />
      )}

      {section === "received" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Payments received{" "}
              <span className="text-muted-foreground font-normal">({receivedRows.length})</span>
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
                {receivedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {payments.length === 0 ? "No payments yet." : "No payments match."}
                    </TableCell>
                  </TableRow>
                ) : (
                  receivedRows.map((p) => (
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
            {receivedRows.length === 0 ? (
              <Card className="p-4 border-border/60 text-center text-sm text-muted-foreground">
                {payments.length === 0 ? "No payments yet." : "No payments match."}
              </Card>
            ) : (
              receivedRows.map((p) => (
                <Card key={p.id} className="p-4 border-border/60 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.memberName}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(p.paidOn)}</div>
                    </div>
                    <div className="font-display font-semibold tabular-nums shrink-0">
                      {inr(p.amount)}
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
      )}

      {section === "trend" && (
        <Card className="p-4 border-border/60 gap-3">
          <div className="text-sm font-medium">Collected, last 6 months</div>
          <div className="space-y-2">
            {months.map((m) => (
              <div key={m.key} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-xs text-muted-foreground">
                  {m.label.split(" ")[0]}
                </div>
                {/* A div with a width percentage. Six bars do not need a chart
                    library — one would be more code than the bars. */}
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
      )}

      <p className="text-[11px] text-muted-foreground">
        What a member owes is taken from what they last paid — the plan price is not stored. Money
        in counts only what you marked as taken. How it was paid (cash, UPI, card) is not recorded.
      </p>
    </div>
  );
}

/**
 * The worklist. Rows are the ordinary member card, so "Take payment" is the
 * same Fees panel as everywhere else — a second way to record money is a
 * second way to get it wrong.
 */
function CollectList({
  dues,
  memberById,
}: {
  dues: ReturnType<typeof computeDues>;
  memberById: Map<string, MemberRow>;
}) {
  const groups = [
    {
      key: "nottaken",
      title: "Never paid for",
      rows: dues.notTaken,
      total: dues.notTakenTotal,
      hint: "You recorded these but marked the money as not taken. Oldest first.",
      tone: "text-destructive",
    },
    {
      key: "overdue",
      title: "Overdue",
      rows: dues.overdue,
      total: dues.overdueTotal,
      hint: "Longest overdue first — start at the top.",
      tone: "text-destructive",
    },
    {
      key: "due",
      title: "Due this month",
      rows: dues.dueThisMonth,
      total: dues.dueThisMonthTotal,
      hint: "Not late yet. A reminder now costs less than chasing later.",
      tone: "text-[oklch(0.85_0.16_85)]",
    },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <Card className="p-6 border-border/60 gap-2 text-center">
        <CheckCircle2 className="size-8 text-[oklch(0.8_0.15_145)] mx-auto" />
        <div className="font-medium">Nothing to collect</div>
        <div className="text-sm text-muted-foreground">
          Every member is paid up and nobody lapses this month.
        </div>
      </Card>
    );
  }

  // Capped: a worklist is read top-down in priority order, so a 1400px-wide
  // row is harder to scan, not easier, and a multi-column grid would break the
  // ordering that makes it a worklist at all.
  return (
    <div className="space-y-6 max-w-2xl">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className={`font-semibold ${g.tone}`}>
              {g.title} <span className="font-normal text-muted-foreground">({g.rows.length})</span>
            </h2>
            <span className="font-display font-semibold tabular-nums">{inr(g.total)}</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">{g.hint}</p>
          <div className="space-y-3">
            {g.rows.map((r) => {
              const member = memberById.get(r.memberId);
              if (!member) return null;
              return (
                <MemberRowItem
                  key={r.memberId}
                  member={member}
                  layout="card"
                  note={`${agingLabel(r.daysOverdue)} · ${inr(r.expected)} expected`}
                  noteTone={r.daysOverdue > 0 ? "bad" : "warn"}
                />
              );
            })}
          </div>
        </div>
      ))}
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

/**
 * The Overview card. Leads with what is still owed, because that is the number
 * that changes what he does today; this month's takings sit under it.
 */
export function MoneyCard({
  payments,
  members,
  onOpen,
}: {
  payments: PaymentRow[];
  members: MemberRow[];
  onOpen: () => void;
}) {
  const thisMonth = currentMonthKey();
  const dues = useMemo(() => computeDues(members), [members]);
  const late = dues.notTaken.length + dues.overdue.length;
  const collected = useMemo(
    () =>
      payments.reduce(
        (sum, p) => (p.collected && monthKey(p.paidOn) === thisMonth ? sum + p.amount : sum),
        0
      ),
    [payments, thisMonth]
  );

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="p-4 border-border/60 gap-3 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-center gap-2">
        <IndianRupee className="size-4 text-primary" />
        <span className="text-xs text-muted-foreground">Money</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xl font-display font-semibold text-[oklch(0.8_0.15_145)]">
            {inr(collected)}
          </div>
          <div className="text-xs text-muted-foreground">Collected this month</div>
        </div>
        <div>
          <div
            className={`text-2xl font-display font-semibold ${
              late ? "text-destructive" : "text-[oklch(0.85_0.16_85)]"
            }`}
          >
            {inr(dues.stillToCollect)}
          </div>
          {/* "Late" is both buckets that are past their date — never-paid and
              overdue. Counting only one made this card disagree with the tab. */}
          <div className="text-xs text-muted-foreground">
            Still to collect{late > 0 && ` · ${late} late`}
          </div>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="w-full pointer-events-none">
        Open the fees book
      </Button>
    </Card>
  );
}
