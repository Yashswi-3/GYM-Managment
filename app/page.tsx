import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QrCode, ShieldCheck } from "lucide-react";
import { GYM_NAME, GYM_TAGLINE } from "@/lib/site";

export default function Home() {
  return (
    <div className="container max-w-3xl py-20 md:py-28 text-center">
      <p className="font-display uppercase tracking-[0.3em] text-sm text-primary mb-4">
        {GYM_NAME}
      </p>
      <h1 className="font-display text-4xl md:text-6xl font-semibold leading-tight mb-5">
        Scan in. Lift. <span className="text-primary">Done.</span>
      </h1>
      <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
        {GYM_TAGLINE}
      </p>

      <div className="barbell-divider max-w-xs mx-auto mb-10">
        <span className="plate" />
        <span className="plate" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/checkin">
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <QrCode className="size-4" />
            Check in
          </Button>
        </Link>
        <Link href="/admin">
          <Button size="lg" variant="secondary" className="gap-2 w-full sm:w-auto">
            <ShieldCheck className="size-4" />
            Admin dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
