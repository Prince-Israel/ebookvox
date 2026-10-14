# Hosting Ebookvox on your own domain (DomainKing)

Ebookvox is **three Node.js apps** (Reader, Publisher, Admin) that stay running, keep a database and write files (uploads, audio cache).
That needs a **VPS / cloud server with root access** (e.g. a DomainKing VPS, 2 vCPU / 2–4 GB RAM / 40 GB disk, Ubuntu 22.04+).
Ordinary shared "cPanel" web hosting is not suitable: it can't keep three always-on Node servers, and its memory limits will kill them.
Check which plans DomainKing currently offers and pick a VPS; the steps below work on any Ubuntu server.

## 1. DNS (at DomainKing → Domains → Manage DNS)

Create three **A records** pointing at your VPS's IP address (shown in the VPS panel):

| Host | Points to | App |
|---|---|---|
| `app` | VPS IP | Reader (`https://app.yourdomain.com`) |
| `publisher` | VPS IP | Publisher |
| `admin` | VPS IP | Admin |

(You may use the bare domain for the Reader instead: an `@` record.) DNS can take up to a few hours to spread.

## 2. Prepare the server (SSH in as root, then use a normal user)

```bash
apt update && apt install -y nginx git ufw certbot python3-certbot-nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
npm i -g pm2
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

## 3. Get the code and configure

```bash
git clone https://github.com/Prince-Israel/ebookvox.git && cd ebookvox
npm ci && (cd publisher && npm ci) && (cd admin && npm ci)
cp .env.example .env && cp publisher/.env.example publisher/.env && cp admin/.env.example admin/.env
bash scripts/generate-secrets.sh      # copy the shared secrets into the three .env files (see docs/CONFIGURATION.md)
```

Edit each `.env` for production:

| Setting | Reader | Publisher | Admin |
|---|---|---|---|
| `APP_URL` | `https://app.yourdomain.com` | `https://publisher.yourdomain.com` | `https://admin.yourdomain.com` |
| `READER_URL` / `PUBLISHER_URL` | — | `READER_URL=http://127.0.0.1:3230` | `READER_URL=http://127.0.0.1:3230`, `PUBLISHER_URL=http://127.0.0.1:3240` |
| `PUBLISHER_WEBHOOK_URL` | `http://127.0.0.1:3240/api/webhooks/reader` | — | — |
| Shared secrets | new random values (not the dev ones) | same pairs | same pairs |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | strong password | strong password | strong password |
| `DEV_AUTO_VERIFY` | **remove / `false`** | **remove / `false`** | — |

`APP_URL` starting with `https://` is what turns on secure cookies. Also fill in:

- **Azure Speech** (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) — **required on Linux**: the macOS-voice and Edge fallbacks used in development don't work on a server.
- **SMTP** — your DomainKing email: host `mail.yourdomain.com`, port 465 or 587, an address you created in cPanel/email, so verification and reset emails are sent.
- **Paystack live keys** (`PAYSTACK_SECRET_KEY=sk_live_…`).
- Google/Apple sign-in, if used (add the production redirect URLs `https://app.yourdomain.com/api/auth/oauth/<provider>/callback`).

## 4. Database, build, start

The default is SQLite (a file on the server's disk — fine to launch with; back it up daily, see step 7).

```bash
for d in . publisher admin; do (cd $d && npx prisma db push && npx prisma generate && npx next build); done
npx tsx prisma/seed.ts                        # Reader: admin account + starter books
(cd publisher && npx tsx prisma/seed.ts) ; (cd admin && npm run db:setup)
npx tsx prisma/seed-catalog.ts --target 1500  # optional: the free public-domain library (docs/CATALOGUE.md)
pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup   # run the command pm2 prints
```

## 5. Web server + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/ebookvox   # edit domains; create /etc/nginx/ebookvox-proxy.conf as described inside
sudo ln -s /etc/nginx/sites-available/ebookvox /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.yourdomain.com -d publisher.yourdomain.com -d admin.yourdomain.com
```

## 6. Point the outside world at the new addresses

- **Paystack dashboard → Settings → API Keys & Webhooks:** webhook URL `https://app.yourdomain.com/api/paystack/webhook`.
- **Mobile apps:** rebuild them against the live Reader and remove the development http exceptions:
  `EBOOKVOX_URL=https://app.yourdomain.com npx cap sync` → Android `./gradlew assembleRelease` (sign with your own key) / iOS archive in Xcode.
  Then publish via Google Play / the App Store.
- Sign in to `https://admin.yourdomain.com` and change the seeded passwords.

## 7. Operating it

- **After editing any `.env`: restart that app** (`pm2 restart ebookvox-reader`) — settings are read only at start-up.
- **Updates:** `git pull`, then for each app `npm ci && npx prisma db push && npx next build`, then `pm2 restart all`.
- **Backups:** the data lives in `prisma/dev.db`, `publisher/prisma/dev.db`, `admin/prisma/dev.db` (and `data/` caches, which can be rebuilt).
  Example nightly job: `sqlite3 prisma/dev.db ".backup /backups/reader-$(date +%F).db"` for each database, copied off the server.
- **Logs / health:** `pm2 logs`, `pm2 status`; the Admin → Status page shows whether the three apps can reach each other.
- **Growing later:** for heavy traffic move to PostgreSQL (change `provider` in each `schema.prisma`; the catalogue search uses `contains`, which is
  case-insensitive on SQLite but case-sensitive on Postgres, so add `mode: "insensitive"` to those queries when you switch).
