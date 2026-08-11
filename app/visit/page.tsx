import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { registerAsVisitor } from "./actions";

export default async function VisitPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; already?: string; name?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const done = sp.done === "1";
  const name = sp.name ?? "";
  const alreadyMember = sp.already === "1";
  const error = sp.error;

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
            {/* Same labelling and native-validation reasoning as /join —
                see the comment there. "Remarks" was a form word nobody says
                out loud; it is the one field here that invites a sentence. */}
            <form action={registerAsVisitor} className="space-y-4 text-left">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Your name</span>
                <Input name="name" autoComplete="name" placeholder="Name" required />
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
                <span className="block text-sm font-medium mb-1.5">
                  Email <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
                <Input type="email" name="email" autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">
                  Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
                <Textarea name="remarks" placeholder="A trial, a guest pass, who you're here with…" rows={3} />
              </label>
              {error && <Alert variant="destructive">{error}</Alert>}
              <FormSubmitButton label="Send my details" pendingLabel="Sending..." className="w-full" />
            </form>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-10 text-primary mx-auto mb-4" strokeWidth={2} />
            <h1 className="font-display text-2xl font-semibold mb-1">
              {alreadyMember ? `You're already a member, ${name}!` : `Thanks, ${name}!`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {alreadyMember
                ? "Use the regular check-in poster to mark yourself present."
                : "Enjoy your visit — see you around!"}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
