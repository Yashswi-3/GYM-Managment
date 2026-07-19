"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { registerAsVisitor } from "./actions";

export default function VisitPage() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; alreadyMember: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerAsVisitor(name, mobile, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ name: result.name, alreadyMember: result.alreadyMember });
    });
  }

  return (
    <div className="container max-w-sm py-16 md:py-24">
      <Card className="p-8 text-center border-border/60">
        {!done ? (
          <>
            <Sparkles className="size-8 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">Welcome, visitor!</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Just your details — no commitment, we&apos;re glad you&apos;re here
            </p>
            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {done.alreadyMember ? `You're already a member, ${done.name}!` : `Thanks, ${done.name}!`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {done.alreadyMember
                ? "Use the regular check-in poster to mark yourself present."
                : "Enjoy your visit — see you around!"}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
