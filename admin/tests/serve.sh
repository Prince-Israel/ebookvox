#!/usr/bin/env bash
# Full ecosystem run: Reader + Publisher + Admin (separate databases) + mock Paystack, all as production builds.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"
export READER_PORT=3130 PUB_PORT=3340 ADMIN_PORT=3350
RS=test-admin-reader-secret-0123456789ab PS=test-admin-publisher-secret-0123456789
rm -f "$ROOT/prisma/test-adm.db"* "$ROOT/publisher/prisma/test-adm.db"* prisma/test.db*
[ "$(uname)" = "Darwin" ] && export TTS_PROVIDER=say

# Reader
(cd "$ROOT" && DATABASE_URL="file:./test-adm.db" npx prisma db push --skip-generate >/dev/null && DATABASE_URL="file:./test-adm.db" npx tsx prisma/seed.ts >/dev/null)
(cd "$ROOT" && DATABASE_URL="file:./test-adm.db" APP_URL="http://localhost:$READER_PORT" PAYSTACK_SECRET_KEY=sk_test_mock PAYSTACK_BASE_URL=http://localhost:4010 \
  PUBLISHER_API_KEY=test-publisher-key PUBLISHER_WEBHOOK_URL="http://localhost:$PUB_PORT/api/webhooks/reader" PUBLISHER_WEBHOOK_SECRET=test-webhook-secret READER_ADMIN_SECRET=$RS npx next start -p $READER_PORT) & R=$!
(cd "$ROOT" && npx tsx tests/mock-paystack.ts) & M=$!
# Publisher
(cd "$ROOT/publisher" && DATABASE_URL="file:./test-adm.db" npx prisma db push --skip-generate >/dev/null && DATABASE_URL="file:./test-adm.db" ADMIN_EMAIL=legacy@publisher.test npx tsx prisma/seed.ts >/dev/null)
(cd "$ROOT/publisher" && DATABASE_URL="file:./test-adm.db" APP_URL="http://localhost:$PUB_PORT" READER_URL="http://localhost:$READER_PORT" PUBLISHER_API_KEY=test-publisher-key READER_WEBHOOK_SECRET=test-webhook-secret PUBLISHER_ADMIN_SECRET=$PS npx next start -p $PUB_PORT) & P=$!
# Admin
export DATABASE_URL="file:./test.db" APP_URL="http://localhost:$ADMIN_PORT" READER_URL="http://localhost:$READER_PORT" PUBLISHER_URL="http://localhost:$PUB_PORT" READER_ADMIN_SECRET=$RS PUBLISHER_ADMIN_SECRET=$PS
export ADMIN_EMAIL=superadmin@ebookvox.app ADMIN_PASSWORD='ChangeMe!2026'
npx prisma db push --skip-generate >/dev/null
npx tsx prisma/seed.ts >/dev/null
npx next dev -p 3351 &


