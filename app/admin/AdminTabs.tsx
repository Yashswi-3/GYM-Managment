"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Sparkles } from "lucide-react";
import StatsCards from "./StatsCards";
import QRCard from "./QRCard";
import ActivityFeed, { type ActivityRow } from "./ActivityFeed";
import PendingSignups, { type PendingMember } from "./PendingSignups";
import AddMemberForm from "./AddMemberForm";
import MembersTable, { type MemberRow, type MemberFilter } from "./MembersTable";
import AddVisitorForm from "./AddVisitorForm";
import VisitorsTable, { type VisitorRow } from "./VisitorsTable";

type Tab = "overview" | "members" | "visitors";

export default function AdminTabs({
  totalMembers,
  paidCount,
  unpaidCount,
  visitorCount,
  convertedCount,
  activity,
  pendingMembers,
  memberRows,
  visitorRows,
}: {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  visitorCount: number;
  convertedCount: number;
  activity: ActivityRow[];
  pendingMembers: PendingMember[];
  memberRows: MemberRow[];
  visitorRows: VisitorRow[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");

  function goToMembersFiltered(filter: MemberFilter) {
    setMemberFilter(filter);
    setTab("members");
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "members" as const, label: "Members", icon: Users },
    {
      id: "visitors" as const,
      label: visitorCount ? `Visitors (${visitorCount})` : "Visitors",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <StatsCards
            totalMembers={totalMembers}
            paidCount={paidCount}
            unpaidCount={unpaidCount}
            visitorCount={visitorCount}
            convertedCount={convertedCount}
            onFilterSelect={goToMembersFiltered}
          />
          <div className="flex flex-wrap gap-3">
            <QRCard path="/checkin" label="Daily check-in" filename="gym-checkin-qr.png" />
            <QRCard path="/join" label="New member signup" filename="gym-join-qr.png" />
            <QRCard path="/visit" label="Visitor self-registration" filename="gym-visit-qr.png" />
          </div>
          <ActivityFeed rows={activity} />
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-6">
          <PendingSignups members={pendingMembers} />
          <AddMemberForm />
          <MembersTable rows={memberRows} filter={memberFilter} onFilterChange={setMemberFilter} />
        </div>
      )}

      {tab === "visitors" && (
        <div className="space-y-6">
          <AddVisitorForm />
          <VisitorsTable rows={visitorRows} />
        </div>
      )}
    </div>
  );
}
