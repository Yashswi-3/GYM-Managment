# Being Fit — Gym Management

A lightweight gym management app for a single gym: an admin panel (members, payments, attendance), three public QR-code entry points for check-in and self-signup, and automated email notifications for upcoming expiry and inactivity.

## Tech Stack

- **Next.js (App Router)**, TypeScript throughout
- **Supabase** — Postgres + Auth + Row-Level Security
- **Vercel** hosting, with Vercel Cron driving the daily notification job (see `vercel.json`)
- **Resend** for transactional email
- **shadcn/ui** + Tailwind CSS v4 for the UI

## Project Structure

```
.
├── app/                  # Next.js app directory (pages, layouts, server actions, API routes)
│   ├── admin/            # Admin panel (members, payments, attendance, visitors)
│   ├── checkin/          # Public QR check-in flow
│   ├── join/             # Public member self-signup
│   ├── visit/             # Public visitor self-registration
│   └── api/notifications/ # Daily cron job (expiry/inactivity emails)
├── lib/                  # Supabase clients, status derivation, phone normalization, email, device tokens
├── supabase/migrations/  # SQL migrations (source of truth for the schema)
└── public/               # Static assets
```

## Installation

```bash
git clone https://github.com/Yashswi-3/GYM-Managment
cd GYM-Managment
npm install
```

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

RESEND_API_KEY=your_resend_api_key
NOTIFICATIONS_FROM_EMAIL=your_notifications_from_address
OWNER_EMAIL=your_gym_owner_email

CRON_SECRET=your_cron_secret
```

## Auth Model

The gym owner is the single Supabase Auth user — any authenticated session is treated as admin. Public routes (`/checkin`, `/join`, `/visit`) never touch Supabase tables directly from the client; all reads/writes go through server actions using the service-role key.
