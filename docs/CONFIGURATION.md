# Where the keys in `.env` come from

Never commit real values: `.env` files are git-ignored; only `.env.example` templates are tracked.

## Secrets you create yourself (no account needed)

These are just long random strings that two apps share so they can trust each other. Generate them with
`bash scripts/generate-secrets.sh` (it runs `openssl rand -hex 32`) and paste the same value into both files:

| Variable | Put it in | Must match |
|---|---|---|
| `PUBLISHER_API_KEY` | Reader `.env` and Publisher `.env` | each other |
| `PUBLISHER_WEBHOOK_SECRET` (Reader) | Reader `.env` | Publisher's `READER_WEBHOOK_SECRET` |
| `READER_ADMIN_SECRET` | Reader `.env` and Admin `.env` | each other |
| `PUBLISHER_ADMIN_SECRET` | Publisher `.env` and Admin `.env` | each other |

Use different values in production than in development, and rotate them if they ever leak.

## Azure Speech (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`)

1. Sign in at <https://portal.azure.com> (a free account includes a free Speech tier: 0.5M characters/month).
2. **Create a resource → AI + Machine Learning → Speech** (or search "Speech service"). Pick a subscription, resource group,
   a region close to your users (e.g. `uksouth`, `westeurope`, `eastus`) and the **Free F0** tier to start.
3. Open the new resource → **Keys and Endpoint**. Copy **KEY 1** → `AZURE_SPEECH_KEY`, and the **Location/Region**
   (lowercase, e.g. `uksouth`) → `AZURE_SPEECH_REGION`.

## Google sign-in (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

1. <https://console.cloud.google.com> → create/select a project → **APIs & Services → OAuth consent screen** (External; add app name, support email).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Add **Authorised redirect URI**: `<APP_URL>/api/auth/oauth/google/callback` (e.g. `http://localhost:3230/...` for dev, your https domain for production).
4. Copy the Client ID and Client secret.

## Apple sign-in (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`)

Requires a paid Apple Developer account (<https://developer.apple.com/account>):

1. **Identifiers → App IDs**: enable *Sign in with Apple* on your app's ID; then create a **Services ID** (this is `APPLE_CLIENT_ID`) and set its
   website domain and return URL (`<APP_URL>/api/auth/oauth/apple/callback`, https required).
2. **Keys → +** → enable *Sign in with Apple* → download the `.p8` file (only offered once). Its **Key ID** is `APPLE_KEY_ID`; the file's contents are `APPLE_PRIVATE_KEY`.
3. `APPLE_TEAM_ID` is shown at the top right of the developer portal (Membership details).

## Other services referenced in `.env`

- **Paystack** (`PAYSTACK_SECRET_KEY`): <https://dashboard.paystack.com> → Settings → API Keys & Webhooks. Use the *test* secret key (`sk_test_…`) until you go live,
  and enable the currencies you sell in (NGN, USD, GBP, EUR) under your account's preferences.
- **SMTP** (`SMTP_*`): from your email provider (Resend, SendGrid, Mailgun, Amazon SES, Zoho…). Without it, emails are only written to the `EmailLog` table.
