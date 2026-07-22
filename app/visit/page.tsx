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
            <form action={registerAsVisitor} className="space-y-3 text-left">
              <Input name="name" placeholder="Name" required />
              <Input type="tel" inputMode="numeric" name="mobile" placeholder="Mobile number" required />
              <Input type="email" name="email" placeholder="Email (optional)" />
              <Textarea name="remarks" placeholder="Remarks (optional)" rows={3} />
              {error && <Alert variant="destructive">{error}</Alert>}
              <FormSubmitButton label="Submit" pendingLabel="Submitting..." className="w-full" />
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
