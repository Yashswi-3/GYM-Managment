"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { joinAsMember } from "./actions";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; alreadyRegistered: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinAsMember(name, mobile, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ name: result.name, alreadyRegistered: result.alreadyRegistered });
    });
  }

  return (
    <div className="container max-w-sm py-16 md:py-24">
      <Card className="p-8 text-center border-border/60">
        {!done ? (
          <>
            <UserPlus className="size-8 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">Join the gym</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Fill this in and the team will confirm your membership shortly
            </p>
            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="Mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <Alert variant="destructive">{error}</Alert>}
              <Button type="submit" disabled={isPending} size="lg" className="w-full">
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              {done.alreadyRegistered ? `Welcome back, ${done.name}!` : `Thanks, ${done.name}!`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {done.alreadyRegistered
                ? "You're already registered — see you at the gym."
                : "Your details are in. The gym team will confirm your plan and payment shortly."}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
