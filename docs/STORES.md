# Publishing the Reader app: Google Play and the Apple App Store

You publish **one app per store**, built from this project (a Capacitor shell around your live Reader website). Before you start:

1. **Host the Reader on https first** (`docs/` → `deploy/DIRECTADMIN.md`). Store builds must point at your real address, not a Mac on your Wi-Fi:
   ```bash
   EBOOKVOX_URL=https://app.yourdomain.com bash scripts/build-mobile.sh      # also makes the debug builds in downloads/
   ```
   (For the stores you build *release* versions as below. Remove the development "allow http" exceptions — see "Before you submit".)
2. Have these ready: app name **Ebookvox**, bundle/package id **app.ebookvox.reader**, icon (1024×1024 is in `resources/`), at least 2 phone screenshots per size, a **privacy-policy URL**, a support email, and a short + long description.
3. Read the **ads / subscription store rules** at the end of `docs/ADS.md` — they decide whether you must add Apple/Google purchases.

---

## Google Play (Android)

**Account:** <https://play.google.com/console> — one-time **US$25** fee. New personal accounts must run a **closed test with ≥12 testers for 14 days** before they can publish to production (organisation accounts skip this, but need D-U-N-S verification).

1. **Create a signing key** (once; keep the file and passwords safe — losing it means you can't update the app):
   ```bash
   keytool -genkey -v -keystore ebookvox-release.jks -alias ebookvox -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Wire the key into Gradle** — create `android/keystore.properties` (never commit it; it is git-ignored):
   ```
   storeFile=../ebookvox-release.jks
   storePassword=…
   keyAlias=ebookvox
   keyPassword=…
   ```
   and in `android/app/build.gradle` add a `signingConfigs { release { … } }` reading that file and set `buildTypes.release.signingConfig signingConfigs.release`
   (the Android docs: *Sign your app → Configure the signing configuration*).
3. **Version:** raise `versionCode` (must increase every upload) and `versionName` in `android/app/build.gradle`.
4. **Build the bundle** (JDK 21):
   ```bash
   EBOOKVOX_URL=https://app.yourdomain.com npx cap sync android
   cd android && ./gradlew bundleRelease -PADMOB_ANDROID_APP_ID=ca-app-pub-…~…
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`.
5. **Play Console → Create app** → name, language, App/Game = App, Free. Complete the dashboard checklist:
   *App content* (privacy policy URL, **Ads: Yes**, target audience, data-safety form — you collect email, name, phone, country, purchases; data is encrypted in transit; users can request deletion), *Store listing* (descriptions, icon 512×512, feature graphic 1024×500, screenshots).
6. **Release → Testing → Closed testing** (or Production if eligible) → *Create release* → upload the `.aab` → add release notes → *Review & roll out*. Opt in to **Play App Signing** when asked.
7. Review usually takes a few hours to a few days. Fix anything Google flags and upload a new `.aab` with a higher `versionCode`.

## Apple App Store (iPhone and iPad)

**Account:** <https://developer.apple.com/programs/> — **US$99/year**. You also need a **Mac with Xcode** (you have one).

1. In **App Store Connect** (<https://appstoreconnect.apple.com>) → *Apps → + → New App*: platform iOS, name **Ebookvox**, language, bundle ID `app.ebookvox.reader` (register it first under *Certificates, Identifiers & Profiles → Identifiers*; enable *Sign in with Apple* on it if you use Apple login), SKU any string.
2. Open the project: `open ios/App/App.xcworkspace` (use the **.xcworkspace**, not the .xcodeproj).
3. In Xcode → target **App → Signing & Capabilities**: tick *Automatically manage signing*, choose your **Team**. Add the capability **Sign in with Apple** if you use it.
4. **Version/build:** target *General* → Version `1.5.0`, Build must increase on every upload (currently kept in step with Android by `scripts/build-mobile.sh`).
5. Point it at your server and remove the dev exception: `EBOOKVOX_URL=https://app.yourdomain.com npx cap sync ios`, then delete the `NSAppTransportSecurity → NSAllowsArbitraryLoads` entry from `ios/App/App/Info.plist` (you are on https now).
6. **Archive:** choose destination *Any iOS Device (arm64)* → menu **Product → Archive**. In the Organizer window press **Distribute App → App Store Connect → Upload**.
7. In App Store Connect → your app → *iOS App → 1.5.0*: fill in screenshots (6.9" and 6.5" iPhone; **13" iPad too, because the app supports iPad**), description, keywords, support URL, **privacy-policy URL**, and **App Privacy** answers (contact info, purchases, identifiers/advertising data because of AdMob). Select the uploaded build, add **review notes + a demo login** (a reviewer account), then **Submit for Review**.
8. Review takes ~1–2 days. Common rejections: no demo account, broken sign-in, ads/tracking not declared, **in-app purchases not using Apple IAP (see `docs/ADS.md`)**, Sign in with Apple missing when Google sign-in exists (it's included).

## Before you submit (both stores)

- [ ] `EBOOKVOX_URL` is your **https** address and the site is up 24/7 (the apps are blank without it; a store reviewer who sees the offline page will reject the app).
- [ ] Real AdMob App IDs set; ad units configured; **test ads off** (`ADMOB_TESTING` removed) only when you're ready to earn — and never tap them yourself.
- [ ] Privacy policy and terms pages are published and linked from the stores.
- [ ] Paystack is in **live** mode; Google/Apple sign-in redirect URLs are your https address (`docs/SOCIAL_LOGIN.md`).
- [ ] You decided how subscriptions are handled under the store rules (`docs/ADS.md`).
- [ ] Update the website's store badges: set `PLAY_STORE_URL` and `APP_STORE_URL` in the Reader's `.env` once the listings are live.
