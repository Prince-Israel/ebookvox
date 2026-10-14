# Ebookvox Reader — Your Words. Our Voice.

Next.js 15 + Prisma (SQLite → Postgres-ready) web app, wrapped for iOS and Android with Capacitor.

## Run the web app
    npm install
    cp .env.example .env      # fill in secrets (see below)
    npm run db:setup          # creates DB, seeds admin + public-domain catalogue
    npm run dev               # http://localhost:3230

Production: `npm run build && npm start`. Set `APP_URL` to your https URL.

## Required configuration (.env)
| Feature | Variables |
|---|---|
| Voices (production) | `TTS_PROVIDER=azure`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| Payments | `PAYSTACK_SECRET_KEY` (webhook URL: `$APP_URL/api/paystack/webhook`). GBP/EUR must be enabled on your Paystack account. |
| Email (verify / reset) | `SMTP_*`, `EMAIL_FROM` (otherwise emails are only stored in `EmailLog`) |
| Google / Apple sign-in | `GOOGLE_CLIENT_ID/SECRET`, `APPLE_*`; redirect URI `$APP_URL/api/auth/oauth/<provider>/callback` |
| Publisher platform | `PUBLISHER_API_KEY`; POST books to `/api/publisher/books` (header `x-publisher-key`). Books appear after admin approval at `/admin`. |
| Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD` (used by the seed) |

## Mobile apps (iOS + Android)
The native shells (`ios/`, `android/`) load your deployed site, so auth, DB, payments and TTS stay server-side.

    export EBOOKVOX_URL=https://your-deployed-domain
    npm run mobile:android    # needs Android Studio + JDK 17+
    npm run mobile:ios        # needs Xcode 16+ (Swift Package Manager, no CocoaPods)

Then Run/Archive from Android Studio / Xcode. App id: `app.ebookvox.reader`. Icons and splash screens are generated.
Apple App Store requires "Sign in with Apple" when offering Google sign-in — configure both.

## Tests
`npm test` (140 API/integration checks, mock Paystack) · `npm run test:ui` (89 browser checks: iPhone/Android/tablet/desktop).

> iOS and Android apps exist **only for the Reader** (this project). Publisher (`publisher/`) and Admin (`admin/`) are web-only.

## Previewing the mobile apps against your dev machine
Run the Reader (`npm run build && npm start`), then `EBOOKVOX_URL=http://<your-LAN-IP>:3230 npm run mobile:android` or `mobile:ios`. The iOS project currently allows plain-http for this preview (NSAllowsArbitraryLoads in Info.plist) — remove it before App Store release and use https.
