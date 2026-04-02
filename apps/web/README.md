This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Auto Assignment Tick Setup

Auto assignment generation runs when the internal tick endpoint is called:

- `GET/POST /api/internal/auto-assign/tick`

### Required env vars

Set these values in `.env`:

- `AUTO_ASSIGN_CRON_SECRET` - bearer token for tick endpoint auth.
- `AUTO_ASSIGN_DEFAULT_INTERVAL_UNIT` - `minute`, `hour`, or `day`.
- `AUTO_ASSIGN_DEFAULT_INTERVAL_VALUE` - interval value (for example `1`).
- `AUTO_ASSIGN_DEFAULT_DECAY_FACTOR` - multiplier for auto-created assignments.
- `AUTO_ASSIGN_DEFAULT_MIN_AUTO_NEW` - minimum number of auto-created assignments.
- `AUTO_ASSIGN_DEFAULT_REVIEW_DELAY_MINUTES` - initial review delay.
- `AUTO_ASSIGN_DEFAULT_MAX_RETRY_PER_ROOT` - retry limit per root assignment.

### Local manual trigger example (PowerShell)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/internal/auto-assign/tick" -Headers @{ Authorization = "Bearer change_me_auto_assign_secret" }
```

### Local automatic tick (no manual call)

In development, auto tick is enabled by default via `src/instrumentation.ts`.

- `AUTO_ASSIGN_DEV_AUTO_TICK=true` enables periodic local tick.
- `AUTO_ASSIGN_DEV_TICK_MS=60000` sets interval in milliseconds.

For fast local testing, set `AUTO_ASSIGN_DEV_TICK_MS=10000` (10 seconds), then restart dev server.

### Production cron

`vercel.json` includes a 1-minute cron job that calls `/api/internal/auto-assign/tick`.
On Vercel, configure `CRON_SECRET` (or `AUTO_ASSIGN_CRON_SECRET`) to match the expected bearer token.
