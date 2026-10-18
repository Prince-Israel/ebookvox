import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";

// The app is server-rendered (auth, DB, payments, TTS stay on the server), so the native shell
// loads your deployed Ebookvox URL. Set EBOOKVOX_URL to the production https address before `cap sync`.
const url = process.env.EBOOKVOX_URL ?? "https://app.ebookvox.example";

// The branded "Connect to internet" page that replaces the system's "Webpage not available". It is bundled inside the app (so it works with
// no connection) and "Try again" goes back to the address above, so it is generated from a template every time the config is read.
try {
  mkdirSync("mobile-www", { recursive: true });
  writeFileSync("mobile-www/offline.html", readFileSync("mobile/offline.template.html", "utf8").replace("__APP_URL__", url));
} catch {}

const config: CapacitorConfig = {
  appId: "app.ebookvox.reader",
  appName: "Ebookvox",
  webDir: "mobile-www",
  server: { url, errorPath: "offline.html", cleartext: url.startsWith("http://"), allowNavigation: ["checkout.paystack.com", "*.paystack.com", "accounts.google.com", "appleid.apple.com"] },
  ios: { contentInset: "never", backgroundColor: "#fbf5ec" },
  android: { backgroundColor: "#fbf5ec", allowMixedContent: false },
  plugins: { Keyboard: { resize: "native", resizeOnFullScreen: true }, SplashScreen: { backgroundColor: "#3a261c", launchShowDuration: 1500 } },
};
export default config;
