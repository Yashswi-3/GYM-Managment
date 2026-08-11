"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { inr, monthKey, monthLabel, currentMonthKey, recentMonthKeys, shiftMonth } from "@/lib/money";
import { buildMonthBook, arrears, agingLabel, allTimeCollected, type FeeMember, type FeeRow } from "@/lib/fees";
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

type Section = "unpaid" | "received" | "trend";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN");
}

/**
 * The fees book, one month at a time.
 *
 * The owner's question is monthly and always the same four parts: how much was
 * this month worth, how much has come in, how much is still out there, and how
 * many people is that. So the month is the frame — a selector at the top, and
 * everything below it belongs to the month on show.
 *
 * The previous version had no month at all. It showed live buckets ("overdue",
 * "due this month") derived from each member's renewal date, so the totals
 * drifted as people paid and there was no way to ask what August was worth.
 * See lib/fees.ts for the identity that replaced it.
 */
export default function MoneyTab({
  payments,
  members,
}: {
  payments: PaymentRow[];
  members: MemberRow[];
}) {
  const thisMonth = currentMonthKey();
  const [month, setMonth] = useState(thisMonth);
  const [section, setSection] = useState<Section>("unpaid");
  const [search, setSearch] = useState("");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const feeMembers: FeeMember[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        status: m.status,
        planPrice: m.planPrice,
        lastPaidAmount: m.amount,
        validUntil: m.validUntil,
      })),
    [members]
  );

  const feePayments = useMemo(
    () => payments.map((p) => ({ memberId: p.memberId, amount: p.amount, paidOn: p.paidOn, collected: p.collected })),
    [payments]
  );

  const book = useMemo(
    () => buildMonthBook(feeMembers, feePayments, month),
    [feeMembers, feePayments, month]
  );

  // Only meaningful against the live month: browsing back to June and being
  // shown "still owed from before June" would mix two questions.
  const late = useMemo(
    () => (month === thisMonth ? arrears(feeMembers, month) : { rows: [], total: 0 }),
    [feeMembers, month, thisMonth]
  );

  const { months, maxMonthTotal, allTime } = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const p of payments) {
      if (!p.collected) continue;
      const k = monthKey(p.paidOn);
      byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount);
    }
    const months = recentMonthKeys(6).map((k) => ({
      key: k,
      label: monthLabel(k),
      total: byMonth.get(k) ?? 0,
    }));
    return {
      months,
      allTime: allTimeCollected(feePayments),
      maxMonthTotal: Math.max(1, ...months.map((m) => m.total)),
    };
  }, [payments, feePayments]);

  const receivedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => monthKey(p.paidOn) === month)
      .filter((p) => (q ? p.memberName.toLowerCase().includes(q) : true))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  }, [payments, month, search]);

  const outstanding = book.stillToCollect + book.notTaken;
  const isCurrent = month === thisMonth;

  // Four numbers, in the order the question gets asked: what was it worth,
  // what came in, what is left, and how many people that is.
  const tiles = [
    { key: "expected", label: "Expected", value: inr(book.expected), tone: "plain", go: "unpaid" as const },
    { key: "collected", label: "Collected", value: inr(book.collected), tone: "good", go: "received" as const },
    {
      key: "outstanding",
      label: "Still to collect",
      value: inr(outstanding),
      tone: outstanding > 0 ? "bad" : "good",
      go: "unpaid" as const,
    },
    {
      key: "who",
      label: "Members paid",
      value: `${book.paidCount} of ${book.paidCount + book.unpaidCount}`,
      tone: "plain",
      go: "unpaid" as const,
    },
  ];

  const toneClass: Record<string, string> = {
    plain: "",
    good: "text-[oklch(0.8_0.15_145)]",
    warn: "text-[oklch(0.85_0.16_85)]",
    bad: "text-destructive",
  };

  const sections: { id: Section; label: string; count?: number }[] = [
    { id: "unpaid", label: "Not paid", count: book.unpaidCount + late.rows.length },
    { id: "received", label: "Received", count: book.paidCount },
    { id: "trend", label: "Trend" },
  ];

  return (
    <div className="space-y-6">
      {/* The month is the frame for everything below it. */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous month"
          onClick={() => setMonth((k) => shiftMonth(k, -1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <div className="font-display text-lg font-semibold">{monthLabel(month)}</div>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => setMonth(thisMonth)}
              className="text-xs text-primary underline underline-offset-2"
            >
              Back to this month
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next month"
          disabled={isCurrent}
          onClick={() => setMonth((k) => shiftMonth(k, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card
            key={t.key}
            role="button"
            tabIndex={0}
            onClick={() => setSection(t.go)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") setSection(t.go);
            }}
            className="p-4 border-border/60 gap-1 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className={`text-2xl font-display font-semibold tabular-nums ${toneClass[t.tone]}`}>
              {t.value}
            </div>
          </Card>
        ))}
      </div>

      {book.notTaken > 0 && (
        <p className="text-xs text-destructive">
          {inr(book.notTaken)} of that was written down as a payment but marked not taken.
        </p>
      )}

      <div className="flex gap-2 border-b border-border/60 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`whitespace-nowrap px-3 py-3 min-h-11 text-sm font-medium border-b-2 -mb-px transition-colors ${
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

      {section === "unpaid" && (
        <div className="space-y-6 max-w-2xl">
          <Worklist
            title={`Not paid for ${monthLabel(month)}`}
            hint="Untaken payments first, then longest waiting. Tap Fees to record the money."
            rows={book.unpaid}
            total={outstanding}
            memberById={memberById}
            empty={
              book.paidCount > 0
                ? "Everyone due this month has paid."
                : "Nobody was due to pay in this month."
            }
          />
          {late.rows.length > 0 && (
            <Worklist
              title="Still owed from earlier months"
              hint="Their term ended before this month and was never renewed. Kept separate so a month's total never changes after the fact."
              rows={late.rows}
              total={late.total}
              memberById={memberById}
            />
          )}
        </div>
      )}

      {section === "received" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Received in {monthLabel(month)}{" "}
              <span className="text-muted-foreground font-normal">({receivedRows.length})</span>
            </h2>
            <Input
              className="w-full sm:w-52"
              placeholder="Search by member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                      No payments in this month.
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
                No payments in this month.
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
        <div className="space-y-3 max-w-2xl">
          <Card className="p-4 border-border/60 gap-3">
            <div className="text-sm font-medium">Collected, last 6 months</div>
            <div className="space-y-2">
              {months.map((mo) => (
                <button
                  key={mo.key}
                  type="button"
                  onClick={() => {
                    setMonth(mo.key);
                    setSection("unpaid");
                  }}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div className="w-14 shrink-0 text-xs text-muted-foreground">
                    {mo.label.split(" ")[0]}
                  </div>
                  {/* A div with a width percentage. Six bars do not need a chart
                      library — one would be more code than the bars. */}
                  <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full rounded ${mo.key === month ? "bg-primary" : "bg-primary/40"}`}
                      style={{ width: `${(mo.total / maxMonthTotal) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-xs tabular-nums">
                    {mo.total ? inr(mo.total) : "—"}
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-4 border-border/60 gap-1">
            <div className="text-xs text-muted-foreground">Collected all time</div>
            <div className="text-2xl font-display font-semibold tabular-nums">{inr(allTime)}</div>
          </Card>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A member is expected in the month their term ends. What they owe comes from their set price,
        or from what they last paid if none is set. Money in counts only what you marked as taken.
        How it was paid (cash, UPI, card) is not recorded.
      </p>
    </div>
  );
}

/**
 * Rows are the ordinary member card, so "Take payment" from here is the same
 * panel as from the Members tab — a second way to record money is a second way
 * to record it wrong.
 */
function Worklist({
  title,
  hint,
  rows,
  total,
  memberById,
  empty,
}: {
  title: string;
  hint: string;
  rows: FeeRow[];
  total: number;
  memberById: Map<string, MemberRow>;
  empty?: string;
}) {
  if (rows.length === 0) {
    if (!empty) return null;
    return (
      <Card className="p-6 border-border/60 gap-2 text-center">
        <CheckCircle2 className="size-8 text-[oklch(0.8_0.15_145)] mx-auto" />
        <div className="font-medium">{empty}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-semibold">
          {title} <span className="font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        <span className="font-display font-semibold tabular-nums text-destructive">{inr(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      <div className="space-y-3">
        {rows.map((r) => {
          const member = memberById.get(r.memberId);
          if (!member) return null;
          const note =
            r.kind === "not_taken"
              ? `${inr(r.amount)} written down but not taken · ${agingLabel(r.daysOverdue)}`
              : `${inr(r.amount)} expected · ${agingLabel(r.daysOverdue)}`;
          return (
            <MemberRowItem
              key={r.memberId}
              member={member}
              layout="card"
              note={note}
              noteTone={r.kind === "not_taken" || r.daysOverdue > 0 ? "bad" : "warn"}
            />
          );
        })}
      </div>
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
