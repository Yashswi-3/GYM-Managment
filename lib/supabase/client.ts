import { createBrowserClient } from "@supabase/ssr";

// Browser client — used in "use client" components. Respects RLS via the anon key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
