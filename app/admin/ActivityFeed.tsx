import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export interface ActivityRow {
  id: string;
  memberName: string;
  checkedInAt: string;
}

export default function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card className="p-4 border-border/60">
      <h2 className="font-display font-semibold mb-3">Recent check-ins</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins yet today.</p>
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 text-sm border-b border-border/40 py-2 last:border-b-0"
            >
              <CheckCircle2 className="size-4 text-primary shrink-0" />
              <span className="font-medium flex-1">{r.memberName}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(r.checkedInAt).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
