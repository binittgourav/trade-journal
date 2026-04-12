# Trade Journal

A React + Vite trade journal with:

- email/password login
- per-user trade storage in Supabase
- strategy and emotion libraries
- analytics dashboard with P&L views

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and add your Supabase values:

```bash
cp .env.example .env
```

3. In Supabase:

- create a new project
- enable Email auth in Authentication
- open the SQL Editor
- run the SQL from [supabase-schema.sql](/Users/binitgourav/trade-journal/supabase-schema.sql)

4. Start the app:

```bash
npm run dev
```

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Deploy

The easiest production path is Vercel.

1. Push this project to GitHub
2. Import the repo into Vercel
3. Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables in Vercel
4. Deploy

## Notes

- Each user only sees their own data through Supabase Row Level Security
- Trade data is no longer stored in browser localStorage
- If email confirmation is enabled in Supabase, new users must confirm before signing in
