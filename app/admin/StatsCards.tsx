import { Card } from "@/components/ui/card";
import { Users, CreditCard, UserX, Sparkles, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MemberFilter } from "./MembersTable";

export default function StatsCards({
  totalMembers,
  paidCount,
  unpaidCount,
  visitorCount,
  convertedCount,
  onFilterSelect,
}: {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  visitorCount: number;
  convertedCount: number;
  /** Clicking Total/Paid/Unpaid jumps to the Members tab pre-filtered. */
  onFilterSelect?: (filter: MemberFilter) => void;
}) {
  const stats: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    tone?: "warn";
    filter?: MemberFilter;
  }[] = [
    { label: "Total members", value: totalMembers, icon: Users, filter: "all" },
    { label: "Paid this month", value: paidCount, icon: CreditCard, filter: "paid" },
    { label: "Unpaid this month", value: unpaidCount, icon: UserX, tone: "warn", filter: "unpaid" },
    { label: "Visitors (all time)", value: visitorCount, icon: Sparkles },
    {
      label: "Visitor → member conversion",
      value: visitorCount ? `${convertedCount}/${visitorCount}` : "0/0",
      icon: Repeat,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => {
        const clickable = !!s.filter && !!onFilterSelect;
        return (
          <Card
            key={s.label}
            className={`p-4 border-border/60 ${clickable ? "text-left cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40" : ""}`}
            {...(clickable
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: () => onFilterSelect!(s.filter!),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") onFilterSelect!(s.filter!);
                  },
                }
              : {})}
          >
            <s.icon className={`size-4 mb-2 ${s.tone === "warn" ? "text-destructive" : "text-primary"}`} />
            <div className="text-2xl font-display font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        );
      })}
    </div>
  );
}
