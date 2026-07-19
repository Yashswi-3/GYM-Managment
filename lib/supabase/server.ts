import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client — used in server components, server actions, and route handlers.
// Reads/writes the auth cookie so `auth.uid()` is available to RLS policies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

// Service-role client — bypasses RLS. Only ever used server-side, and only
// for the daily notification job which needs to read across all members.
export async function createServiceClient() {
  const { createClient: createRawClient } = await import("@supabase/supabase-js");
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
