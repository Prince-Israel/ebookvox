# Ebookvox Admin — Your Words. Our Voice.

Central operations platform for the Ebookvox ecosystem (Reader + Publisher). Next.js 15 · Prisma (own database) · RBAC.

## Run
    cd admin && npm install
    cp .env.example .env           # set secrets
    npm run db:setup               # schema + first Super Admin (ADMIN_EMAIL / ADMIN_PASSWORD)
    npm run dev                    # http://localhost:3250

## Architecture
* **Admin has its own database** (admins, sessions, activity log, notifications, settings). It never connects to the other databases.
* **Service API.** Reader and Publisher each expose `/api/internal/*`, reachable only with an HMAC-SHA256 signature
  (`timestamp ‖ method ‖ path?query ‖ sha256(body)`, 60 s window, mutations can't be replayed) made with
  `READER_ADMIN_SECRET` / `PUBLISHER_ADMIN_SECRET`. Secrets live only in server environment variables.
* **Notifications** come from an append-only event feed on each service that Admin pulls with a cursor (no push, nothing lost).
* **Failures:** if a service is down, its cards/pages show "Unavailable" with the service name and a Retry — never zero. Technical
  errors are stored in `ServiceErrorLog`.
* **Publisher → Admin → Reader:** Admin approves → Publisher service re-publishes the book to the Reader (with retries); rejection
  reasons go straight back to the publisher.

## Roles & permissions (enforced on every API call)
Super Admin (all + admin management) · Operations · Content Manager · Finance · Support. Permissions: users, publishers, authors,
books, book_review, orders, transactions, sales, payouts, support, analytics, activity_logs, settings, admins. A Super Admin can tailor
permissions per person; changes apply to live sessions immediately.

## Behaviour worth knowing
* Deleting a user/publisher **anonymises** them (orders and sales are financial records and are kept).
* A book that has been **bought** can't be hard-deleted; Admin offers **Archive** (hidden from the catalogue, buyers keep access).
* A payout can only be marked **Paid** with a valid destination and a payout reference. There's no automatic bank/PayPal transfer.
* Settings pushed to services: categories → Publisher, minimum withdrawals → Publisher, default voice → Reader.

## Tests
`npm test` (238 API checks across all three platforms) · `npm run test:ui` (100 browser checks) · `npm run lint` · `npm run typecheck`.

## Mobile
Admin is a **web-only** platform. There is intentionally no iOS/Android app (and no Capacitor project) for Admin — only the Reader has native apps.
