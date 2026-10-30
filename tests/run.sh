#!/usr/bin/env bash
# Full integration run: isolated SQLite DB, mock Paystack, production build of the app.
set -euo pipefail
cd "$(dirname "$0")/.."
# Tests must never send real email or call real services, whatever the developer's .env contains.
export SMTP_HOST="" SMTP_USER="" SMTP_PASS="" AZURE_SPEECH_KEY="" AZURE_SPEECH_REGION="" GOOGLE_CLIENT_ID="" APPLE_CLIENT_ID=""
export CRON_SECRET="test-cron-secret-123456"
export ADMOB_ANDROID_BANNER_ID="" ADMOB_ANDROID_VIDEO_ID="" ADMOB_IOS_BANNER_ID="" ADMOB_IOS_VIDEO_ID="" ADMOB_TESTING="" # never depend on the real ad units in .env
# Ad settings the UI tests rely on: website banners + a video tag (the tests serve a stand-in for Google's IMA script)
export ADSENSE_CLIENT="ca-pub-1234567890123456" ADSENSE_SLOT_HOME_TOP="1111111111" ADSENSE_SLOT_HOME_BOTTOM="2222222222" VIDEO_AD_TAG_URL="https://ads.example.test/vast.xml"
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
