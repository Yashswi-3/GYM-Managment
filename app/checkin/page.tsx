"use client";

import { useState, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dumbbell, CheckCircle2, UserPlus, Loader2 } from "lucide-react";
import { lookupMobile, checkInMember, registerVisitor, attemptDeviceCheckIn } from "./actions";

type Stage =
  | "checking-device"
  | "enter-mobile"
  | "confirm-member"
  | "register-visitor"
  | "done"
  | "done-auto";

export default function CheckInPage() {
  const [stage, setStage] = useState<Stage>("checking-device");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Remembered-device flow: try a silent, zero-tap check-in first. Only
  // falls through to the manual mobile-entry form if this browser isn't
  // recognized (new phone, cleared cookies, first-ever visit, etc).
  useEffect(() => {
    let cancelled = false;
    attemptDeviceCheckIn().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setGreeting(result.name);
        setStage("done-auto");
      } else {
        setStage("enter-mobile");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupMobile(mobile);
      if (result.recognized) {
        setGreeting(result.firstName ?? null);
        setStage("confirm-member");
      } else {
        setStage("register-visitor");
      }
    });
  }

  function handleConfirmPresent() {
    setError(null);
    startTransition(async () => {
      const result = await checkInMember(mobile);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGreeting(result.name);
      setStage("done");
    });
  }

  async function handleVisitorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerVisitor(name, mobile);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setGreeting(result.name ?? name);
      setStage("done");
    });
  }

  function reset() {
    setStage("enter-mobile");
    setMobile("");
    setName("");
    setGreeting(null);
    setError(null);
  }

  return (
    <div className="container max-w-sm py-16 md:py-24">
      <Card className="p-8 text-center border-border/60">
        {stage === "checking-device" && (
          <div className="py-8">
            <Loader2 className="size-6 text-muted-foreground mx-auto animate-spin" />
          </div>
        )}

        {stage === "enter-mobile" && (
          <>
            <Dumbbell className="size-8 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">Welcome in</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your mobile number to check in
            </p>
            <form onSubmit={handleMobileSubmit} className="space-y-3">
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="Mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                autoFocus
                className="h-12 text-center text-lg"
              />
              {error && <Alert variant="destructive">{error}</Alert>}
              <Button type="submit" loading={isPending} size="lg" className="w-full">
                {isPending ? "Checking..." : "Continue"}
              </Button>
            </form>
          </>
        )}

        {stage === "confirm-member" && (
          <>
            <Dumbbell className="size-8 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              Welcome back{greeting ? `, ${greeting}` : ""}!
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Tap to confirm you&apos;re here</p>
            {error && <Alert variant="destructive" className="mb-3">{error}</Alert>}
            <Button onClick={handleConfirmPresent} loading={isPending} size="lg" className="w-full">
              {isPending ? "Checking in..." : "Check in"}
            </Button>
          </>
        )}

        {stage === "register-visitor" && (
          <>
            <UserPlus className="size-8 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">Nice to meet you</h1>
            <p className="text-sm text-muted-foreground mb-6">
              First time here? Just your name to get started
            </p>
            <form onSubmit={handleVisitorSubmit} className="space-y-3">
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="h-12 text-center text-lg"
              />
              {error && <Alert variant="destructive">{error}</Alert>}
              <Button type="submit" loading={isPending} size="lg" className="w-full">
                {isPending ? "Saving..." : "Register"}
              </Button>
            </form>
          </>
        )}

        {stage === "done-auto" && (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              Welcome back{greeting ? `, ${greeting}` : ""}!
            </h1>
            <p className="text-sm text-muted-foreground">You&apos;re checked in. See you on the floor.</p>
          </>
        )}

        {stage === "done" && (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              You&apos;re all set{greeting ? `, ${greeting}` : ""}!
            </h1>
            <p className="text-sm text-muted-foreground mb-6">See you on the floor</p>
            <Button variant="secondary" onClick={reset} className="w-full">
              Done
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
