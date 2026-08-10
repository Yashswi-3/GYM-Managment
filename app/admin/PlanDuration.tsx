"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { todayISO, endOfTerm } from "@/lib/status";

const PRESETS = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "Quarterly" },
  { months: 12, label: "Yearly" },
];

function labelFor(months: number) {
  return PRESETS.find((p) => p.months === months)?.label ?? `${months} months`;
}

function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/**
 * Term picker for the three forms that start a payment cycle: approve a
 * signup, add a member, take a payment. Emits both fields the server actions
 * read — planName (the term's label) and validUntil.
 *
 * The date the owner picks is the START of the term, not the end. The end is
 * derived and shown as text rather than a third input: two dates side by side
 * on a phone invites picking the wrong one, and the end date is a consequence
 * of the other two answers, not an independent decision. An odd-length term
 * goes through Custom; an arbitrary end date is a correction, which is what
 * the Edit form is for.
 *
 * Not used by the Edit form — editing is correcting a record that already
 * exists, so that one keeps raw date fields.
 */
export default function PlanDuration({ stack = false }: { stack?: boolean }) {
  const [months, setMonths] = useState(1);
  const [isCustom, setIsCustom] = useState(false);
  const [startDate, setStartDate] = useState(() => todayISO());

  const endDate = startDate ? endOfTerm(startDate, months) : "";

  function pickPreset(value: string) {
    if (value === "custom") {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    setMonths(Number(value));
  }

  // Non-stack is the compact form-row variant, and the only places that render
  // it are md-and-up (the members table is `hidden md:block`). So it stacks
  // full-width on a phone regardless — which is what the pending card wants.
  const field = stack ? "w-full" : "w-full md:w-36";

  return (
    <>
      {/* What the server actions actually receive. */}
      <input type="hidden" name="planName" value={labelFor(months)} />
      <input type="hidden" name="validUntil" value={endDate} />

      <label className={stack ? "w-full" : "contents"}>
        <span className="sr-only">Plan length</span>
        <Select
          aria-label="Plan length"
          value={isCustom ? "custom" : String(months)}
          onChange={(e) => pickPreset(e.target.value)}
          className={field}
        >
          {PRESETS.map((p) => (
            <option key={p.months} value={p.months}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </Select>
      </label>

      {isCustom && (
        <Input
          type="number"
          min={1}
          max={120}
          step={1}
          aria-label="Number of months"
          placeholder="Months"
          defaultValue={months}
          // Clamped rather than rejected: the only wrong values reachable here
          // are an empty box mid-typing and a fat-fingered 0.
          onChange={(e) => setMonths(Math.min(120, Math.max(1, Number(e.target.value) || 1)))}
          className={stack ? "w-full" : "w-full md:w-28"}
        />
      )}

      <label className={stack ? "w-full" : "w-full md:w-auto"}>
        <span className="block text-[11px] text-muted-foreground mb-1">Starts on</span>
        <Input
          type="date"
          aria-label="Start date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={stack ? "w-full" : "w-full md:w-40"}
          required
        />
      </label>

      {endDate && (
        <div className={`text-xs text-muted-foreground ${stack ? "w-full" : "w-full md:w-auto md:self-end md:pb-2"}`}>
          Ends <span className="text-foreground font-medium">{fmtDate(endDate)}</span>
        </div>
      )}
    </>
  );
}
