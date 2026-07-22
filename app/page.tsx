import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The app has exactly one public entry point for staff: log in, land on the
// dashboard. There's nothing to choose between here on purpose — the
// checkin/join/visit routes are only ever reached via their printed QR
// codes, never by navigating this page.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/admin" : "/login");
}
