import { Card } from "@/components/ui/card";
import { Users, CreditCard, UserX, Sparkles, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function StatsCards({
  totalMembers,
  paidCount,
  unpaidCount,
  visitorCount,
  convertedCount,
}: {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  visitorCount: number;
  convertedCount: number;
}) {
  const stats: { label: string; value: string | number; icon: LucideIcon; tone?: "warn" }[] = [
    { label: "Total members", value: totalMembers, icon: Users },
    { label: "Paid this month", value: paidCount, icon: CreditCard },
    { label: "Unpaid this month", value: unpaidCount, icon: UserX, tone: "warn" },
    { label: "Visitors (all time)", value: visitorCount, icon: Sparkles },
    {
      label: "Visitor → member conversion",
      value: visitorCount ? `${convertedCount}/${visitorCount}` : "0/0",
      icon: Repeat,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 border-border/60">
          <s.icon className={`size-4 mb-2 ${s.tone === "warn" ? "text-destructive" : "text-primary"}`} />
          <div className="text-2xl font-display font-semibold">{s.value}</div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </Card>
      ))}
    </div>
  );
}
