#!/usr/bin/env bash
# Starts the same isolated stack as run.sh but leaves it running (for manual / debugging sessions).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="file:./test.db" APP_URL="http://localhost:3100" PAYSTACK_SECRET_KEY="sk_test_mock" PAYSTACK_BASE_URL="http://localhost:4010"
[ "$(uname)" = "Darwin" ] && export TTS_PROVIDER=say
export PUBLISHER_API_KEY="test-publisher-key" ADMIN_EMAIL="admin@ebookvox.app" ADMIN_PASSWORD="ChangeMe!2026"
rm -f prisma/test.db prisma/test.db-journal
npx prisma db push --skip-generate >/dev/null
npx tsx prisma/seed.ts >/dev/null
npx tsx tests/mock-paystack.ts &
exec npx next start -p 3100
