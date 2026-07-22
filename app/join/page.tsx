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
            <form action={joinAsMember} className="space-y-3 text-left">
              <Input name="name" placeholder="Full name" required />
              <Input type="tel" inputMode="numeric" name="mobile" placeholder="Mobile number" required />
              <Input type="email" name="email" placeholder="Email" required />
              {error && <Alert variant="destructive">{error}</Alert>}
              <FormSubmitButton label="Submit" pendingLabel="Submitting..." className="w-full" />
            </form>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              {alreadyRegistered ? `Welcome back, ${name}!` : `Thanks, ${name}!`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {alreadyRegistered
                ? "You're already registered — see you at the gym."
                : "Your details are in. The gym team will confirm your plan and payment shortly."}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
