# Hosting Ebookvox with DirectAdmin

DirectAdmin is only the control panel (domains, DNS, SSL, email). Whether Ebookvox can run depends on **what kind of server DirectAdmin is on**.
Ebookvox is three Node.js apps (Reader, Publisher, Admin), so first find out which case you have:

| What you see in DirectAdmin | Case | Verdict |
|---|---|---|
| **Extra Features → "Setup Node.js App"** (or "Node.js Selector") | Shared hosting with CloudLinux Node support | Works, within limits → **Path A** |
| **No Node.js option**, and you can't log in over SSH | Plain shared hosting (PHP only) | **Cannot run Ebookvox.** Ask your host to enable Node.js, or move to a VPS. |
| You have **root SSH** (a VPS or dedicated server that runs DirectAdmin) | Full server | Best → **Path B** |

(Ask DomainKing support: "Does my plan include Node.js apps, how much RAM/processes do I get, and do I have SSH?")

Whichever path: also read `docs/CONFIGURATION.md` (keys) and set the production `.env` values listed in `deploy/DEPLOY.md` §3 —
`APP_URL=https://…`, new random secrets, `DEV_AUTO_VERIFY` removed, Azure Speech key (required on Linux), SMTP, live Paystack keys.

---

## Getting the files onto the server

Either `git clone` on the server (needs SSH — see below) or upload zips from your Mac:

```bash
bash scripts/package-for-upload.sh      # creates upload/ebookvox-reader.zip, ebookvox-publisher.zip, ebookvox-admin.zip (source only, a few hundred KB each)
```

In DirectAdmin → **System Info & Files → File Manager** (or SFTP), create three folders in your home directory — `reader`, `publisher`, `admin` — upload each zip into its folder
and use **Extract**. Then continue with Path A (step 4 onwards) or Path B. Each app runs from its own folder and has its own `.env`.
The zips never contain `.env` files, databases or `node_modules`; you create those on the server.

## Path A — shared DirectAdmin with Node.js Selector

**Be realistic about limits.** Each app needs roughly 300–600 MB of RAM when running, and `next build` needs about 1 GB while building.
Shared plans often allow only 512 MB–1 GB in total, so three apps may be killed or refused. If the apps keep restarting ("503", "Service unavailable"), the plan is too small — use a VPS.
You could start with just the **Reader** (the product users see) and add Publisher/Admin on a bigger plan.

1. **Subdomains** — DirectAdmin → *Account Manager → Subdomain Management*: create `app`, `publisher`, `admin` (or use the main domain for the Reader).
2. **HTTPS** — *Account Manager → SSL Certificates → Free & automatic certificate from Let's Encrypt*, tick the main domain and each subdomain.
3. **Upload the code** — easiest over SSH (*File Manager* upload also works):
   ```bash
   cd ~ && git clone https://github.com/Prince-Israel/ebookvox.git && cd ebookvox
   cp deploy/directadmin/server.js server.js
   cp deploy/directadmin/server.js publisher/server.js
   cp deploy/directadmin/server.js admin/server.js
   ```
4. **Create each app** — *Extra Features → Setup Node.js App → Create Application*:

   | Field | Reader | Publisher | Admin |
   |---|---|---|---|
   | Node.js version | 20 | 20 | 20 |
   | Application mode | Production | Production | Production |
   | Application root | `ebookvox` | `ebookvox/publisher` | `ebookvox/admin` |
   | Application URL | `app.yourdomain.com` | `publisher.yourdomain.com` | `admin.yourdomain.com` |
   | Startup file | `server.js` | `server.js` | `server.js` |

   Press **Create**; the panel shows a command like `source /home/USER/nodevenv/ebookvox/20/bin/activate && cd /home/USER/ebookvox` — copy it into your SSH session so `node` and `npm` are the right version.
5. **Install, set up and build** (in each app's folder, with the activated environment):
   ```bash
   cp .env.example .env            # then edit it: see the production table in deploy/DEPLOY.md
   npm ci
   npx prisma db push && npx prisma generate
   NODE_OPTIONS=--max-old-space-size=1024 npx next build
   ```
   Build **on the server** (not on your Mac): `sharp` and Prisma ship platform-specific binaries, so a Mac build won't run on Linux.
   Reader only, once: `npx tsx prisma/seed.ts` (admin + starter books) and optionally `npx tsx prisma/seed-catalog.ts --target 500` (a smaller free library fits small plans better).
   Publisher and Admin: `npm run db:setup`.
6. **Start** — in *Setup Node.js App* press **Restart** on each app, then open the URLs. After any `.env` edit, press **Restart** again.
7. **Outside services** — Paystack webhook `https://app.yourdomain.com/api/paystack/webhook`; Google/Apple redirect URLs; rebuild the mobile apps with
   `EBOOKVOX_URL=https://app.yourdomain.com npx cap sync` (see `deploy/DEPLOY.md` §6).

Service-to-service addresses in the `.env` files can stay on the public https URLs here, because each app is a separate site:
Publisher `READER_URL=https://app.yourdomain.com`; Admin `READER_URL`/`PUBLISHER_URL` the two public https URLs; Reader
`PUBLISHER_WEBHOOK_URL=https://publisher.yourdomain.com/api/webhooks/reader`.

## Path B — DirectAdmin on a VPS (root access)

Follow `deploy/DEPLOY.md` for the server work (Node 20, `npm ci`, `.env`, build, **PM2** with `deploy/ecosystem.config.cjs`). Use DirectAdmin for the parts it is good at:

1. **DNS / subdomains / SSL** in DirectAdmin exactly as in Path A steps 1–2 (no need for certbot or hand-written nginx server blocks).
2. **Send each domain to its app.** *Domain Setup / Custom HTTPD Configurations* (the exact name varies with the DirectAdmin version) for each subdomain:
   - **Apache** (needs `mod_proxy`, `mod_proxy_http`, `mod_headers`):
     ```apache
     ProxyPreserveHost On
     RequestHeader set X-Forwarded-Proto "https"
     ProxyPass / http://127.0.0.1:3230/
     ProxyPassReverse / http://127.0.0.1:3230/
     ```
   - **Nginx** (or nginx in front of Apache):
     ```nginx
     location / {
       proxy_pass http://127.0.0.1:3230;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 120s;
       client_max_body_size 80m;
     }
     ```
   Use port **3230** for `app.`, **3240** for `publisher.`, **3250** for `admin.`. Save, and DirectAdmin rebuilds the web-server config.
3. If the panel offers no way to add the proxy, ask DomainKing support to add that reverse-proxy rule, or put nginx on a spare port as in `deploy/nginx.conf.example`.

## Email (verification and password-reset emails)

DirectAdmin → *E-Mail Accounts*: create e.g. `no-reply@yourdomain.com`. In each `.env` set
`SMTP_HOST=mail.yourdomain.com`, `SMTP_PORT=465` (or 587), `SMTP_USER=no-reply@yourdomain.com`, `SMTP_PASS=…`, `EMAIL_FROM="Ebookvox <no-reply@yourdomain.com>"`.
Add the SPF/DKIM records DirectAdmin shows under *E-Mail Accounts → DNS/DKIM* so mail doesn't land in spam.

## Troubleshooting

- **503 / "Incomplete response"** → the app crashed: check *Setup Node.js App → the log link*, or `~/ebookvox/stderr.log`. Usually a missing `.env` value, not enough memory, or a skipped `next build`.
- **Pages load but login fails** → `APP_URL` must be the exact `https://` address you browse to.
- **Admin shows "Unavailable"/"rejected our credentials"** → the shared secrets differ between apps, or you edited a `.env` and didn't restart that app.
- **No sound / voices fail** → `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are missing.
