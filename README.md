# cloudbeds-to-xubio

Minimal webhook-to-invoice service bridging Cloudbeds accounting transactions to Xubio invoices.

## Quick start

1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. `npm run migrate` (requires DATABASE_URL)
4. `npm run start` (requires Vercel CLI for local dev) or deploy to Vercel.