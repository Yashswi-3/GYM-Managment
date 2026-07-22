"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function HeaderAuth({ email }: { email: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!email) {
    return (
      <Link href="/login">
        <Button variant="secondary">Admin sign in</Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-sm min-w-0">
      <span className="hidden sm:inline text-muted-foreground truncate max-w-[40vw]">
        {email}
      </span>
      <Button variant="secondary" size="sm" onClick={signOut} className="shrink-0">
        Sign out
      </Button>
    </div>
  );
}
