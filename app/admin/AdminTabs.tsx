"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Sparkles, Plus, X, QrCode, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatsCards from "./StatsCards";
import NeedsYou from "./NeedsYou";
import QRCard from "./QRCard";
import ActivityFeed, { type ActivityRow } from "./ActivityFeed";
import PendingSignups, { type PendingMember } from "./PendingSignups";
import AddMemberForm from "./AddMemberForm";
import MembersTable, { type MemberRow, type MemberFilter } from "./MembersTable";
import AddVisitorForm from "./AddVisitorForm";
import VisitorsTable, { type VisitorRow } from "./VisitorsTable";
import MoneyTab, { MoneyCard, type PaymentRow } from "./MoneyTab";

type Tab = "overview" | "members" | "money" | "visitors";

export default function AdminTabs({
  totalMembers,
  paidCount,
  unpaidCount,
  visitorCount,
  convertedCount,
  activity,
  pendingMembers,
  defaultAmount,
  expiringCount,
  memberRows,
  visitorRows,
  paymentRows,
}: {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  visitorCount: number;
  convertedCount: number;
  activity: ActivityRow[];
  pendingMembers: PendingMember[];
  defaultAmount: number | null;
  expiringCount: number;
  memberRows: MemberRow[];
  visitorRows: VisitorRow[];
  paymentRows: PaymentRow[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [showQR, setShowQR] = useState(false);
  // The add-member / add-visitor forms stay collapsed behind the "+" button
  // so each tab opens straight to the list — the thing you actually read.
  const [showAddForm, setShowAddForm] = useState(false);

  function switchTab(next: Tab) {
    setTab(next);
    setShowAddForm(false);
  }

  function goToMembersFiltered(filter: MemberFilter) {
    setMemberFilter(filter);
    switchTab("members");
  }

  // Only two tabs have something to add. Fees records payments against a
  // member who already exists — that is the Fees button on their row, not a
  // form up here, so the "+" would have opened Add visitor on the wrong tab.
  const canAdd = tab === "members" || tab === "visitors";
  const addLabel = tab === "members" ? "Add member" : "Add visitor";

  const tabs = [
    { id: "overview" as const, label: "Overview", short: "Overview", icon: LayoutDashboard },
    { id: "members" as const, label: "Members", short: "Members", icon: Users },
    { id: "money" as const, label: "Fees", short: "Fees", icon: IndianRupee },
    {
      id: "visitors" as const,
      label: visitorCount ? `Visitors (${visitorCount})` : "Visitors",
      short: "Visitors",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {canAdd && (
          <Button
            size="sm"
            variant={showAddForm ? "secondary" : "default"}
            onClick={() => setShowAddForm((open) => !open)}
            aria-label={showAddForm ? "Close form" : addLabel}
          >
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            <span className="hidden sm:inline">{showAddForm ? "Close" : addLabel}</span>
          </Button>
        )}
      </div>

      {/* Desktop: top tab strip. Mobile uses the fixed bottom bar below. */}
      <div className="hidden md:flex gap-1 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
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
          <NeedsYou
            pendingCount={pendingMembers.length}
            unpaidCount={unpaidCount}
            expiringCount={expiringCount}
            onGoToPending={() => switchTab("members")}
            onFilterSelect={goToMembersFiltered}
          />
          <MoneyCard payments={paymentRows} members={memberRows} onOpen={() => switchTab("money")} />
          <StatsCards
            totalMembers={totalMembers}
            paidCount={paidCount}
            unpaidCount={unpaidCount}
            visitorCount={visitorCount}
            convertedCount={convertedCount}
            onFilterSelect={goToMembersFiltered}
          />
          <ActivityFeed rows={activity} />

          {/* The QR posters are a print-once job, not a daily one. They used to
              sit above the activity feed and take the whole screen on a phone. */}
          <div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowQR((open) => !open)}
              aria-expanded={showQR}
            >
              <QrCode className="size-4" />
              {showQR ? "Hide QR posters" : "Show QR posters"}
            </Button>
            {showQR && (
              <div className="flex flex-wrap gap-3 mt-3">
                <QRCard path="/checkin" label="Daily check-in" filename="gym-checkin-qr.png" badge="C" />
                <QRCard path="/join" label="New member signup" filename="gym-join-qr.png" badge="M" />
                <QRCard path="/visit" label="Visitor self-registration" filename="gym-visit-qr.png" badge="V" />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-6">
          <PendingSignups members={pendingMembers} defaultAmount={defaultAmount} />
          {showAddForm && <AddMemberForm />}
          <MembersTable rows={memberRows} filter={memberFilter} onFilterChange={setMemberFilter} />
        </div>
      )}

      {tab === "money" && <MoneyTab payments={paymentRows} members={memberRows} />}

      {tab === "visitors" && (
        <div className="space-y-6">
          {showAddForm && <AddVisitorForm />}
          <VisitorsTable rows={visitorRows} />
        </div>
      )}

      {/* Mobile: app-style fixed bottom navigation. */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                tab === t.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <t.icon className="size-5" />
              {t.short}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
