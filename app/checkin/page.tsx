"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dumbbell, CheckCircle2, UserPlus } from "lucide-react";
import { lookupMobile, checkInMember, registerVisitor } from "./actions";

type Stage = "enter-mobile" | "confirm-member" | "register-visitor" | "done";

export default function CheckInPage() {
  const [stage, setStage] = useState<Stage>("enter-mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
              <Button type="submit" disabled={isPending} size="lg" className="w-full">
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
            <Button onClick={handleConfirmPresent} disabled={isPending} size="lg" className="w-full">
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
              <Button type="submit" disabled={isPending} size="lg" className="w-full">
                {isPending ? "Saving..." : "Register"}
              </Button>
            </form>
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
