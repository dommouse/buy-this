# BUY THIS — Relationship Concierge

Gift-finding web app: questionnaire → AI gift engine (`src/engine`) → four recommendation slots.

## Stack

- TanStack Start (Vite + React 19 + TypeScript)
- Tailwind CSS 4
- Supabase (Postgres + RLS)
- Claude (Anthropic) for gift suggestions
- Skimlinks for BUY THIS affiliate URLs

## Run locally

This is a **Node/Vite app**, not Apache/PHP. From the project root:

```sh
npm install
npm run dev
```

Open the URL Vite prints (this project often uses `http://localhost:8080`).

### Database migrations

```sh
# Put DB_PASSWORD or DATABASE_URL in .env first
npm run db:migrate
```

### Engine helpers

```sh
npm run engine:test-parse
npm run engine:train
```

## Environment

Copy `.env.example` → `.env` (already created). Fill at least:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude gift suggestions (primary) |
| `SKIMLINKS_PUBLISHER_ID` | Affiliate wrap on BUY THIS |
| `DB_PASSWORD` / `DATABASE_URL` | Apply SQL migrations |

See `src/engine/README.md` for engine architecture.

## Routes

| Path | Role |
| --- | --- |
| `/` | Landing |
| `/questionnaire` | Gift Q&A |
| `/results` | Engine recommendations + email capture |
| `/about` | FAQ |
| `/buy-me`, `/login` | Waitlist placeholders |
