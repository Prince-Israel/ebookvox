#!/usr/bin/env bash
# Full cross-platform integration run: Publisher + Reader (separate databases) + mock Paystack.
set -euo pipefail
cd "$(dirname "$0")/.."
# Tests must never send real email or call real services, whatever the developer's .env contains.
export SMTP_HOST="" SMTP_USER="" SMTP_PASS="" AZURE_SPEECH_KEY="" AZURE_SPEECH_REGION="" GOOGLE_CLIENT_ID="" APPLE_CLIENT_ID=""
ROOT="$(cd .. && pwd)"
export PUB_PORT=3340 READER_PORT=3130
rm -f prisma/test.db* "$ROOT/prisma/test-pub.db"*

# --- Reader (root project) ---
(cd "$ROOT" && DATABASE_URL="file:./test-pub.db" npx prisma db push --skip-generate >/dev/null && DATABASE_URL="file:./test-pub.db" ADMIN_EMAIL=admin@ebookvox.app ADMIN_PASSWORD='ChangeMe!2026' npx tsx prisma/seed.ts >/dev/null)
(cd "$ROOT" && DATABASE_URL="file:./test-pub.db" APP_URL="http://localhost:$READER_PORT" PAYSTACK_SECRET_KEY=sk_test_mock PAYSTACK_BASE_URL=http://localhost:4010 \
  PUBLISHER_API_KEY=test-publisher-key PUBLISHER_WEBHOOK_URL="http://localhost:$PUB_PORT/api/webhooks/reader" PUBLISHER_WEBHOOK_SECRET=test-webhook-secret \
  npx next start -p $READER_PORT) & READER=$!
(cd "$ROOT" && npx tsx tests/mock-paystack.ts) & MOCK=$!

# --- Publisher ---
export DATABASE_URL="file:./test.db" APP_URL="http://localhost:$PUB_PORT" READER_URL="http://localhost:$READER_PORT" PUBLISHER_API_KEY=test-publisher-key READER_WEBHOOK_SECRET=test-webhook-secret
export ADMIN_EMAIL=admin@publisher.ebookvox.app ADMIN_PASSWORD='ChangeMe!2026'
npx prisma db push --skip-generate >/dev/null
npx tsx prisma/seed.ts >/dev/null
npx next start -p $PUB_PORT & PUB=$!
trap 'kill $READER $MOCK $PUB 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf localhost:$PUB_PORT/sign-in >/dev/null && curl -sf localhost:$READER_PORT/sign-in >/dev/null && break; sleep 0.5; done
BASE=http://localhost:$PUB_PORT READER=http://localhost:$READER_PORT npx tsx "tests/${1:-api}.test.ts"
