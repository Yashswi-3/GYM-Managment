import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import HeaderAuth from "@/components/header-auth";
import { GYM_NAME } from "@/lib/site";
import { Dumbbell } from "lucide-react";
import Link from "next/link";

const displayFont = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: GYM_NAME,
  description: "Check-in, membership, and payments for " + GYM_NAME,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className="dark">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased min-h-screen`}>
        <header className="w-full border-b border-border/60 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <nav className="container flex items-center justify-between py-4">
            <Link href="/" className="flex items-center gap-2 font-display font-semibold text-lg tracking-wide">
              <Dumbbell className="size-5 text-primary" strokeWidth={2.5} />
              {GYM_NAME.toUpperCase()}
            </Link>
            <HeaderAuth email={user?.email ?? null} />
          </nav>
        </header>
        <main className="min-h-[calc(100vh-65px)]">{children}</main>
      </body>
    </html>
  );
}
