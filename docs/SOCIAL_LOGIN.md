# "Sign in with Google / Apple" — web and mobile

Both buttons are already on the Sign in and Create account screens and work in the website **and** inside the iOS/Android apps. They stay inert until you add the credentials.

## 1. Get the credentials (once)

See `docs/CONFIGURATION.md` for the click-by-click. In short:

| Provider | You need | Set in the Reader `.env` |
|---|---|---|
| Google | an OAuth **Web application** client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Apple | a **Services ID**, a **Sign in with Apple key** (.p8), your Team ID | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

Register these **redirect URLs** with the providers (replace the domain; Apple requires https and a real domain — `localhost` doesn't work for Apple):

```
https://app.yourdomain.com/api/auth/oauth/google/callback
https://app.yourdomain.com/api/auth/oauth/apple/callback
```

Make sure `APP_URL` in the Reader `.env` is that same https address, then restart the Reader. Try the buttons on `/sign-in`.

## 2. How it works on the website

Button → `/api/auth/oauth/<provider>/start` → Google/Apple → `/callback` → the user is signed in and sent back to where they were headed (or Home).
First-time users get an account created from their provider email (country guessed from their location; default voice and currency follow it).
An existing account with the same, provider-verified email is linked automatically.

## 3. How it works in the mobile apps

Google **blocks** sign-in inside an embedded web view ("disallowed_useragent"), and Apple expects the system browser too. So in the app:

1. The button opens the phone's own browser (Chrome Custom Tab / Safari View Controller) at `/api/auth/oauth/<provider>/start?mobile=1`.
2. After the user approves, the callback finishes by redirecting to **`ebookvox://oauth?code=…`** — a custom link the apps register (Android intent-filter, iOS URL scheme).
3. The app receives it (`NativeBridge`), closes the browser, swaps the one-time code (valid 3 minutes, single use) for a session at `/api/auth/oauth/mobile/exchange`, and continues.

No extra setup is needed beyond the credentials above — the same Google/Apple client works for the website and both apps because the browser always returns to the web redirect URL first.

## 4. Store rules to remember

- **Apple App Store rule 4.8:** an iOS app that offers Google (or any third-party) sign-in **must also offer Sign in with Apple** — the app does.
- Google's OAuth consent screen must be set to **In production** (not "Testing") or only listed test users can sign in. Add your privacy-policy and terms URLs.
- Apple "hide my email" relay addresses work: the user is created with the relay address Apple provides.

## 5. Testing it

- Website: open `/sign-in`, press **Continue with Google**. You should land on Google's account chooser, then back in the app signed in.
- Android: install the APK, press the button — Chrome opens, you approve, the app comes back signed in. (`adb shell am start -a android.intent.action.VIEW -d "ebookvox://oauth?code=test"` simulates the return trip; it will just show an error toast for a fake code.)
- If you see "…isn't set up on this server yet", the credentials aren't loaded: check `.env` and restart the Reader.
