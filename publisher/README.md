# Ebookvox Publisher — Your Words. Our Voice.

Platform for authors and publishers to upload, review, publish, sell and monetise books on the Ebookvox Reader.
Next.js 15 · Prisma (SQLite → Postgres-ready) · its own database, sessions and auth (separate from Reader).

## Run
    cd publisher && npm install
    cp .env.example .env     # set secrets
    npm run db:setup         # schema + admin account
    npm run dev              # http://localhost:3240

## How it connects to the Reader
| Direction | Mechanism |
|---|---|
| Publisher → Reader | After **admin approval**, the server POSTs the book (chapters, prices in NGN/GBP/EUR/USD, cover URL) to the Reader's `/api/publisher/books` with `PUBLISHER_API_KEY`. Failed syncs retry every minute. |
| Reader → Publisher | The Reader writes **sale** and **book-status** events to an outbox (same DB transaction as the verified Paystack payment) and delivers them, HMAC-signed (`PUBLISHER_WEBHOOK_SECRET` = `READER_WEBHOOK_SECRET`), to `/api/webhooks/reader`, with retries. |

Set on the Reader: `PUBLISHER_API_KEY`, `PUBLISHER_WEBHOOK_URL=<publisher>/api/webhooks/reader`, `PUBLISHER_WEBHOOK_SECRET`.

## Business rules (src/lib/config.ts)
* Sales are created **only** from signed Reader events; the 85 % / 15 % split is computed server-side in integer minor units.
* Wallets are per currency (readers pay in their own currency). Balance = SUM of an append-only ledger.
* Minimum withdrawal: ₦100,000 · $100 (GBP £80 / EUR €95 are configurable assumptions). One open withdrawal at a time; idempotent requests.
* Nigerian publishers → bank transfer; international → PayPal. Payouts are processed manually by an admin (no payout API is integrated).

## Admin
`/admin` (seeded `ADMIN_EMAIL`): review queue (approve / reject with reason), withdrawals (paid / reject), support, publishers.

## Tests
`npm test` (149 API checks incl. real Reader + mock Paystack) · `npm run test:ui` (74 browser checks, 5 form factors).

## Mobile
Publisher is a **web-only** platform. There is intentionally no iOS/Android app (and no Capacitor project) for Publisher — only the Reader has native apps.
