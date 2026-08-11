import { Card } from "@/components/ui/card";
import { Users, CreditCard, UserX, Sparkles, Repeat, IndianRupee } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { inr } from "@/lib/money";
import type { MemberFilter } from "./MembersTable";

export default function StatsCards({
  totalMembers,
  paidCount,
  unpaidCount,
  visitorCount,
  convertedCount,
  collectedThisMonth,
  onFilterSelect,
  onOpenMoney,
}: {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  visitorCount: number;
  convertedCount: number;
  collectedThisMonth: number;
  /** Clicking Total/Paid/Unpaid jumps to the Members tab pre-filtered. */
  onFilterSelect?: (filter: MemberFilter) => void;
  /** The money tile opens the fees book rather than filtering members. */
  onOpenMoney?: () => void;
}) {
  const stats: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    tone?: "warn" | "good";
    onSelect?: () => void;
  }[] = [
    { label: "Members", value: totalMembers, icon: Users, onSelect: onFilterSelect && (() => onFilterSelect("all")) },
    {
      label: "Paid this month",
      value: paidCount,
      icon: CreditCard,
      onSelect: onFilterSelect && (() => onFilterSelect("paid")),
    },
    {
      label: "Not paid",
      value: unpaidCount,
      icon: UserX,
      tone: "warn",
      onSelect: onFilterSelect && (() => onFilterSelect("unpaid")),
    },
    // The sixth tile replaces a full-width money card that sat above this grid
    // breaking the row of squares. One number — what came in this month — and
    // a tap into the fees book, where the detail belongs.
    {
      label: "Collected this month",
      value: inr(collectedThisMonth),
      icon: IndianRupee,
      tone: "good",
      onSelect: onOpenMoney,
    },
    { label: "Visitors, all time", value: visitorCount, icon: Sparkles },
    {
      label: "Visitors who joined",
      value: visitorCount ? `${convertedCount} of ${visitorCount}` : "0 of 0",
      icon: Repeat,
    },
  ];

  const iconTone = {
    warn: "text-destructive",
    good: "text-[oklch(0.8_0.15_145)]",
  } as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map((s) => {
        const clickable = !!s.onSelect;
        return (
          <Card
            key={s.label}
            className={`p-4 border-border/60 ${clickable ? "text-left cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40" : ""}`}
            {...(clickable
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: s.onSelect,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") s.onSelect!();
                  },
                }
              : {})}
          >
            <s.icon className={`size-4 mb-2 ${s.tone ? iconTone[s.tone] : "text-primary"}`} />
            <div
              className={`text-2xl font-display font-semibold tabular-nums ${
                s.tone === "good" ? iconTone.good : ""
              }`}
            >
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        );
      })}
    </div>
  );
}
