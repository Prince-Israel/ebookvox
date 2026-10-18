import type { CapacitorConfig } from "@capacitor/cli";

// The app is server-rendered (auth, DB, payments, TTS stay on the server), so the native shell
// loads your deployed Ebookvox URL. Set EBOOKVOX_URL to the production https address before `cap sync`.
const url = process.env.EBOOKVOX_URL ?? "https://app.ebookvox.example";

const config: CapacitorConfig = {
  appId: "app.ebookvox.reader",
  appName: "Ebookvox",
  webDir: "mobile-www",
  server: { url, cleartext: url.startsWith("http://"), allowNavigation: ["checkout.paystack.com", "*.paystack.com", "accounts.google.com", "appleid.apple.com"] },
  ios: { contentInset: "never", backgroundColor: "#fbf5ec" },
  android: { backgroundColor: "#fbf5ec", allowMixedContent: false },
  plugins: { Keyboard: { resize: "native", resizeOnFullScreen: true }, SplashScreen: { backgroundColor: "#3a261c", launchShowDuration: 1500 } },
};
export default config;
