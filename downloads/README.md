# Ebookvox Reader — downloads

| File | For | Notes |
|---|---|---|
| `Ebookvox-Reader-android.apk` | Android phones/tablets | Debug-signed, installable directly. |
| `Ebookvox-Reader-ios-unsigned.ipa` | iPhone/iPad | **Unsigned.** Apple only runs signed apps, so install it with a sideloading tool that signs it with your Apple ID (AltStore, Sideloadly) — or open `ios/App` in Xcode and run it with your own team. |
| `Ebookvox-Reader-ios-simulator.zip` | Xcode iOS Simulator | Unzip and drag `App.app` onto a running simulator. Loads `http://localhost:3230`. |

## Which version do I have?

`VERSION.txt` lists the current build (**1.3.0, build 5**). The installed app shows the same at the bottom of **Profile**. Each new APK has a higher build number, so
installing it over an older one updates it (if Android refuses with "App not installed", uninstall the old Ebookvox first).

## Where the app gets its content

The mobile app is a native shell around the Reader web app, so it needs the Reader server to be reachable.
These builds point at the development Mac's address on your network (see `VERSION.txt`, currently `http://172.20.10.3:3230`), so the phone must be on
the same network with the Reader running (`npx next start -p 3230`).

To build against your deployed (https) server instead:

```bash
EBOOKVOX_URL=https://reader.your-domain.com npx cap sync
# Android (JDK 21):  cd android && ./gradlew assembleDebug   → android/app/build/outputs/apk/debug/app-debug.apk
# iOS:  cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -sdk iphoneos \
#         CODE_SIGNING_ALLOWED=NO build
```

For a Play Store release use `./gradlew bundleRelease` with your own signing key; for the App Store archive and sign in Xcode.

## Listening with the screen off

- **Android:** while Ebookvox is reading, a "Reading aloud" notification appears (allow notifications when asked). It keeps the narration going when you lock the phone, let the screen dim, or switch to another app. Tap **Stop** on the notification, press pause in the app, or swipe the app away to stop.
- **iOS:** the app declares the *audio* background mode, so narration continues with the screen locked or the app minimised; use the lock-screen controls to pause.
- Moving between Home, Books, Library and Profile never interrupts reading — a mini player follows you. Only pause, the ✕ on the mini player, or closing the app stops it.
