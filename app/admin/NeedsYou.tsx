"use client";

import { Card } from "@/components/ui/card";
import { UserCheck, IndianRupee, CalendarClock, Check, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MemberFilter } from "./MembersTable";

/**
 * The home screen answers one question: what needs me today. The owner used
 * to assemble that by hand across three tabs — who signed up, who hasn't
 * paid, whose membership is about to lapse.
 *
 * Each row is a whole tappable card rather than a small link, because this is
 * used one-handed on a phone. Rows with a count of zero are dropped instead of
 * shown as "0" — a zero is not a task, and an empty list is the good outcome.
 */
export default function NeedsYou({
  pendingCount,
  unpaidCount,
  expiringCount,
  onGoToPending,
  onFilterSelect,
}: {
  pendingCount: number;
  unpaidCount: number;
  expiringCount: number;
  onGoToPending: () => void;
  onFilterSelect: (filter: MemberFilter) => void;
}) {
  const tasks: {
    key: string;
    count: number;
    title: string;
    hint: string;
    icon: LucideIcon;
    tone: string;
    onSelect: () => void;
  }[] = [
    {
      key: "pending",
      count: pendingCount,
      title: pendingCount === 1 ? "person is waiting for your OK" : "people are waiting for your OK",
      hint: "They scanned the join QR. Approve so they can check in.",
      icon: UserCheck,
      tone: "text-primary",
      onSelect: onGoToPending,
    },
    {
      key: "unpaid",
      count: unpaidCount,
      title: unpaidCount === 1 ? "member has not paid" : "members have not paid",
      hint: "No payment recorded this month.",
      icon: IndianRupee,
      tone: "text-destructive",
      onSelect: () => onFilterSelect("unpaid"),
    },
    {
      key: "expiring",
      count: expiringCount,
      title: expiringCount === 1 ? "membership ends soon" : "memberships end soon",
      hint: "Three days or less left. Good time to remind them.",
      icon: CalendarClock,
      tone: "text-[oklch(0.85_0.16_85)]",
      onSelect: () => onFilterSelect("expiring"),
    },
  ].filter((t) => t.count > 0);

  if (tasks.length === 0) {
    return (
      <Card className="p-6 border-border/60 flex items-center gap-3">
        <Check className="size-6 text-[oklch(0.8_0.15_145)] shrink-0" />
        <div>
          <div className="font-semibold">Nothing needs you right now</div>
          <div className="text-sm text-muted-foreground">
            Everyone is approved, paid up, and not about to expire.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Needs you</h2>
      {tasks.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={t.onSelect}
          className="w-full text-left rounded-lg border border-border/60 bg-card p-4 flex items-center gap-4 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <t.icon className={`size-6 shrink-0 ${t.tone}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-semibold leading-none">{t.count}</span>
              <span className="text-sm font-medium">{t.title}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
          </div>
          <ChevronRight className="size-5 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}
