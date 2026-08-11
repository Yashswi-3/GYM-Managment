import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { joinAsMember } from "./actions";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; already?: string; name?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const done = sp.done === "1";
  const name = sp.name ?? "";
  const alreadyRegistered = sp.already === "1";
  const error = sp.error;

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
            {/* Labelled, not placeholder-only: a placeholder disappears the
                moment you type into it, so anyone who looks away mid-form
                loses the only thing telling them what the box is for — and a
                screen reader never had it. The native constraints matter more
                than they look: a server-side rejection redirects and wipes
                every field, so catching a typo in the browser is what stops a
                member retyping all three on a phone. `mobile` accepts the
                separators people actually type; lib/phone.ts strips them. */}
            <form action={joinAsMember} className="space-y-4 text-left">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Your name</span>
                <Input name="name" autoComplete="name" placeholder="Full name" required />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Mobile number</span>
                <Input
                  type="tel"
                  inputMode="tel"
                  name="mobile"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  pattern="[0-9+\-\s]{7,20}"
                  title="Digits only, plus + - and spaces if you like"
                  required
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Email</span>
                <Input type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
              {error && <Alert variant="destructive">{error}</Alert>}
              <FormSubmitButton label="Send my details" pendingLabel="Sending..." className="w-full" />
            </form>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              {alreadyRegistered ? `Welcome back, ${name}!` : `Thanks, ${name}!`}
            </h1>
            {/* Says the quiet part now that approval is actually enforced: a
                fresh signup cannot check in yet. Without this they scan the
                check-in QR the same afternoon, get sent down the visitor
                path, and think the gym lost their details. */}
            <p className="text-sm text-muted-foreground">
              {alreadyRegistered
                ? "You're already registered — see you at the gym."
                : "Your details are in. Speak to the gym owner to set up your plan — you'll be able to check in once they've confirmed you."}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
