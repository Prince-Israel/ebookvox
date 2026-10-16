# Showing ads: Google AdSense (website) and AdMob (mobile apps)

AdSense and AdMob are two products of the same Google account family: **AdSense** serves ads on **websites**, **AdMob** serves ads inside **iOS/Android apps**.
You can't use AdSense inside the apps or AdMob on the website. Ebookvox is already wired for AdSense; AdMob needs a native plugin (steps below).

## 1. AdSense on the web app (already built in)

1. Create an account at <https://adsense.google.com> and add your site (your Reader domain, e.g. `app.yourdomain.com`). Google reviews it — this can take days or weeks, and
   it wants real content, a privacy policy page and a working site. The 6,000+ free books help.
2. Once the site is added, AdSense shows your **publisher ID** (`ca-pub-1234567890123456`). Put it in the Reader's `.env`:
   ```
   ADSENSE_CLIENT="ca-pub-1234567890123456"
   ```
   The site then serves `https://yourdomain/ads.txt` automatically (AdSense checks for it; "Earnings at risk" warnings go away within a day).
3. In AdSense → **Ads → By ad unit → Display ads** create two units ("Home" and "Books"). Copy each unit's numeric **data-ad-slot** and set:
   ```
   ADSENSE_SLOT_HOME="1234567890"
   ADSENSE_SLOT_BOOKS="0987654321"
   ```
4. Restart the Reader (`pm2 restart ebookvox-reader`). Ads appear on the Home page (between the book carousel and the "Publish your books" banner) and at the bottom of the Books list.
   Nothing shows until both the client and a slot are set, and ads never render inside the mobile apps.
5. **Consent:** in the EEA/UK you must show a cookie-consent banner (AdSense → Privacy & messaging → create a GDPR message — Google hosts it for you) and link a privacy policy.
   Don't click your own ads; use the AdSense "ad preview" instead.

Ads are deliberately **not** placed inside the reading view, so reading and listening stay uninterrupted.

## 2. AdMob in the Android and iOS apps (needs a native plugin)

1. Create an account at <https://admob.google.com>, then **Apps → Add app** twice (Android, iOS). For each, AdMob gives an **App ID** (`ca-app-pub-XXXX~YYYY`).
   Create ad units (Banner, and optionally Interstitial) → each has an **Ad unit ID** (`ca-app-pub-XXXX/ZZZZ`).
2. Install the community plugin and sync:
   ```bash
   npm i @capacitor-community/admob@7
   npx cap sync
   ```
3. **Android** — in `android/app/src/main/AndroidManifest.xml`, inside `<application>`:
   ```xml
   <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
   ```
   **iOS** — in `ios/App/App/Info.plist` add `GADApplicationIdentifier` (string, your iOS App ID), `NSUserTrackingUsageDescription` ("This lets us show you more relevant ads.") and the
   `SKAdNetworkItems` list Google publishes (<https://developers.google.com/admob/ios/quick-start#update_your_infoplist>).
4. Show a banner from the web code (only inside the app). Add a small client component, e.g. `src/components/AdMobBanner.tsx`, and render it once in `AppShell`:
   ```tsx
   "use client";
   import { useEffect } from "react";
   import { isNativeApp } from "@/lib/public-config";

   export function AdMobBanner() {
     useEffect(() => {
       if (!isNativeApp()) return;
       (async () => {
         const { AdMob, BannerAdPosition, BannerAdSize } = await import("@capacitor-community/admob");
         await AdMob.initialize();
         await AdMob.showBanner({
           adId: "ca-app-pub-3940256099942544/6300978111", // Google's TEST banner id — swap for your own unit id before release
           adSize: BannerAdSize.ADAPTIVE_BANNER,
           position: BannerAdPosition.BOTTOM_CENTER,
           margin: 64, // keep it above the bottom navigation bar
           isTesting: true,
         });
       })().catch(() => {});
       return () => { import("@capacitor-community/admob").then(({ AdMob }) => AdMob.removeBanner()).catch(() => {}); };
     }, []);
     return null;
   }
   ```
   Always develop with Google's **test ad unit IDs** (above) — clicking real ads on your own device can get the account suspended.
5. **Consent (required in the EEA/UK) and iOS tracking prompt:** AdMob → Privacy & messaging → create a consent message, then call `AdMob.requestConsentInfo()` /
   `AdMob.showConsentForm()` and on iOS `AdMob.requestTrackingAuthorization()` before showing ads (see the plugin README).
6. **Store rules:** declare "Contains ads" in the Play Console and the advertising-ID usage in App Store Connect's privacy section; update your privacy policy accordingly.
   Keep ads out of the reader/player screens and away from controls so taps aren't accidental (a Google policy).

Rebuild and re-test both apps after adding the plugin: `npx cap sync` then the Android/iOS builds in `downloads/README.md`.
