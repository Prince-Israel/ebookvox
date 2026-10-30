# Ads and the ad-free subscription

Ebookvox shows ads to readers who haven't subscribed, and none at all to subscribers.

| Where | What | Provider |
|---|---|---|
| Website, top and bottom of **Home** | a very small one-line banner | **Google AdSense** |
| Website, when the voice is about to start | a **video ad**, once per listening session | any **VAST** video tag through Google's IMA player (Google Ad Manager, AdSense for Video, or a video ad network) |
| Android + iPhone apps, top and bottom of **Home** | a very small banner (320×50) | **Google AdMob** |
| Android + iPhone apps, when the voice is about to start | a full-screen **video ad**, once per listening session | **Google AdMob** (video interstitial) |

**When does the video ad play?** Once before the voice first reads. If the reader leaves the app/page and later presses play again, it plays again before the voice resumes.
While the voice keeps reading (even with the screen off or the app minimised) nothing interrupts it, and moving on to the next chapter by itself shows no ad.

**Subscribers** ($2/month, or $1.80/month on the yearly plan, converted to the reader's currency) see no banners and no video ads, on web, Android and iPhone alike —
the subscription belongs to the account, so it works wherever they sign in. Readers can pay by card (Paystack) or from their in-app **wallet**.

Until you add your own ad accounts the **apps show Google's TEST ads** (clearly labelled "Test Ad", safe to tap, earn nothing) and the **website shows no ads**.
Everything below is how to switch real ads on. Settings are read when the Reader starts — restart it after editing `.env` (`pm2 restart ebookvox-reader`, or "Restart" in DirectAdmin's Node.js app).

---

## 1. Website banners — Google AdSense

1. Sign up at <https://adsense.google.com> and add your site (the Reader's address). Google reviews it, which can take days or weeks; it wants real content, a privacy-policy page and HTTPS.
   (EEA/UK visitors also need a consent banner: AdSense → *Privacy & messaging* → create a GDPR message.)
2. When approved, AdSense shows your publisher ID, `ca-pub-1234567890123456`.
3. **Ads → By ad unit → Display ads → create two units** — name them *Home top* and *Home bottom*. Shape: *Horizontal*, and choose a small fixed size (e.g. 320×50 or 728×90).
   Each unit has a numeric **ad slot** (the `data-ad-slot` number in the code Google shows).
4. In the Reader's `.env`:
   ```
   ADSENSE_CLIENT="ca-pub-1234567890123456"
   ADSENSE_SLOT_HOME_TOP="1111111111"
   ADSENSE_SLOT_HOME_BOTTOM="2222222222"
   ```
5. Restart the Reader. The two banners appear on Home (hidden for subscribers and inside the mobile apps), and `https://yourdomain/ads.txt` is served automatically, which AdSense checks.

## 2. Website video ad (before the voice)

AdSense itself doesn't sell video-before-content on websites, so this uses a **VAST video tag**, which you get from one of:

- **Google Ad Manager** (free tier): *Delivery → Video and audio ads tag → create tag* → copy the **ad tag URL**. You can then fill the slot with AdSense for Video / AdX demand or direct deals.
- A video ad network that gives a VAST tag (SpotX, Magnite, Vidoomy…).

Put it in `.env`:
```
VIDEO_AD_TAG_URL="https://pubads.g.doubleclick.net/gampad/ads?iu=/YOURNETWORK/your-unit&sz=640x480&output=vast&unviewed_position_start=1&env=vp&impl=s&gdfp_req=1&correlator="
```
Google's own **sample tag** for trying it out (a demo video ad): <https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags>.
If the tag returns no ad, fails, or the visitor's ad-blocker stops it, playback simply starts — the ad never blocks the voice.

## 3. Mobile apps — Google AdMob (banners and video)

1. Sign up at <https://admob.google.com>. **Apps → Add app** twice (Android, iOS) — each gives an **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
2. For each app create two **ad units**: a **Banner**, and an **Interstitial** (this is the full-screen video ad; AdMob serves video here). Each unit has an ID `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`.
3. Ad unit IDs go in the Reader's `.env` (the apps read them from the server, so changing them needs **no app update**):
   ```
   ADMOB_ANDROID_BANNER_ID="ca-app-pub-…/…"
   ADMOB_ANDROID_VIDEO_ID="ca-app-pub-…/…"
   ADMOB_IOS_BANNER_ID="ca-app-pub-…/…"
   ADMOB_IOS_VIDEO_ID="ca-app-pub-…/…"
   ```
   While any of these four is missing the apps use Google's test ads. To force test ads even with real IDs (recommended while testing on your own phone): `ADMOB_TESTING="true"`.
4. The two **App IDs** are built into the apps, so they are set when you build (they're not secrets):
   ```bash
   ADMOB_ANDROID_APP_ID="ca-app-pub-…~…" ADMOB_IOS_APP_ID="ca-app-pub-…~…" bash scripts/build-mobile.sh
   ```
   (Android reads `ADMOB_ANDROID_APP_ID`; for the Play Store build also pass it to Gradle, e.g. `./gradlew bundleRelease -PADMOB_ANDROID_APP_ID=…`.)
5. **Never tap real ads on your own phone** (it can get the AdMob account suspended). Use test ads, or register your phone as a test device in AdMob.
6. **Consent & privacy:** EEA/UK users need AdMob's consent message (AdMob → *Privacy & messaging*), and iPhones show Apple's tracking prompt (already wired). Declare **"Contains ads"** in Play Console and
   the advertising-ID use in App Store Connect's privacy answers, and mention ads in your privacy policy.

> **How the banners behave in the apps:** the AdMob plugin can show one banner at a time, so the header banner shows while you're at the top of Home and the footer banner once you reach the bottom (the page keeps blank bands for them so they never cover content).

---

## The subscription and wallet

| | |
|---|---|
| Plans | **Monthly $2.00**; **Yearly $21.60** (= $1.80/month, 10% off) — converted to the reader's currency at the live international rate (`open.er-api.com`, refreshed hourly, last rate stored) and fixed at the moment they pay |
| Pay by | **Card** (Paystack) or **wallet** balance (tops up by card). Wallet money is per currency; it can pay for a subscription in the currency of where the reader is |
| Where | `/subscribe` and `/wallet` (web and the apps — the app is the same site) |
| Renewal | A subscription ends after its period and ads return. Card payments are **not** repeated automatically (Paystack needs the reader's consent each time); readers can turn on "renew from my wallet" and it renews itself while funds last |
| Admin | **Admin → Subscribers**: who, plan, status, renewal date, what they paid and how, wallet, plus totals and monthly recurring revenue; a notification for each new subscriber |

### ⚠️ Important: store rules for in-app subscriptions

Apple's App Store (guideline 3.1.1) and Google Play's payments policy require that **digital features sold inside an app — including "remove ads" subscriptions — use Apple In-App Purchase / Google Play Billing**
(the stores keep 15–30%). Ebookvox's subscription and wallet use Paystack, which is fine **on the website**, but an app that offers them can be **rejected or removed** by the stores.
Options when you publish:

1. **Safest:** in the store builds, hide the "Go ad-free" and Wallet buttons (readers subscribe on the website; the subscription then works in the app because it belongs to the account). Apple allows this "reader-style" model for content bought elsewhere only if the app doesn't link to or advertise the outside purchase, so keep the app silent about it.
2. **Fully compliant:** add native purchases (e.g. RevenueCat or the Capacitor purchases plugins) with the same $2 / $21.60 products and have the server mark the account ad-free from the store receipt. This is real extra work and extra store fees.

Get advice for your situation before submitting; policies change.

## Reward video: "watch a video to listen"

Free (non-subscribed) listeners watch one short video before the voice reads. The reward is access to listen.
- It comes up **immediately** when they submit a new text, upload a file, or open a free book, and again once they have left or closed the app (or logged out) and come back.
- A video watched to the end unlocks listening. Closing or skipping it early does not: the reward asks again.
- If there is nothing to show (no ad configured, blocked, no fill) it never blocks listening.
- Subscribers never see it.

Set up:
- **Website:** the same VAST tag as before (`VIDEO_AD_TAG_URL`).
- **Mobile apps:** create a **Rewarded** ad unit in AdMob for each platform and set `ADMOB_ANDROID_REWARDED_ID` and `ADMOB_IOS_REWARDED_ID` in the Reader `.env`. Without them the apps use the interstitial video units (and Google's test rewarded units while `ADMOB_TESTING` is on).
