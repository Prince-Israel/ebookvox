#!/usr/bin/env bash
# Full integration run: isolated SQLite DB, mock Paystack, production build of the app.
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="file:./test.db"
export APP_URL="http://localhost:3100"
export PAYSTACK_SECRET_KEY="sk_test_mock"
export PAYSTACK_BASE_URL="http://localhost:4010"
[ "$(uname)" = "Darwin" ] && export TTS_PROVIDER=say   # keyless local fallback for the test machine
export PUBLISHER_API_KEY="test-publisher-key"
export ADMIN_EMAIL="admin@ebookvox.app" ADMIN_PASSWORD="ChangeMe!2026"
rm -f prisma/test.db prisma/test.db-journal
npx prisma db push --skip-generate >/dev/null
npx tsx prisma/seed.ts >/dev/null
npx tsx tests/mock-paystack.ts & MOCK=$!
npx next start -p 3100 & APP=$!
trap 'kill $MOCK $APP 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -sf localhost:3100/sign-in >/dev/null && break; sleep 0.5; done
BASE=http://localhost:3100 npx tsx "tests/${1:-api}.test.ts"
