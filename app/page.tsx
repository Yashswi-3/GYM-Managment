import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QrCode, ShieldCheck } from "lucide-react";
import { GYM_NAME, GYM_TAGLINE } from "@/lib/site";

export default function Home() {
  return (
    <div className="container max-w-3xl py-16 md:py-20 text-center">
      <p className="font-display uppercase tracking-[0.3em] text-sm text-primary mb-6">
        {GYM_NAME}
      </p>

      <div className="signal-block px-6 py-10 md:py-14 mb-8">
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-4">
          Scan in. Lift. Done.
        </h1>
        <p className="text-base md:text-lg opacity-90 max-w-xl mx-auto">
          {GYM_TAGLINE}
        </p>
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
